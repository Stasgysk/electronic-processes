/* global config */

// Bootstraps all Sequelize connections defined in config.postgresql, loads every model,
// runs sync (optionally with force/alter based on FORCE_SYNC_DB env var),
// then seeds initial data and ensures the process workflow template exists in the n8n DB.

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const basedir = path.join(__dirname, '/../models/');
const db = {};
const { v4: uuidv4 } = require('uuid');
let nanoid;
// nanoid is ESM-only so it has to be imported dynamically
(async () => {
    const { nanoid: nanoidFn } = await import('nanoid');
    nanoid = nanoidFn;
})();

const reconnectOptions = {
    retry_on_reconnect: {
        transactions: true,
    },
    max_retries: 999,
    onRetry: function (count) {
        logger.info(`Connection lost, trying to reconnect (${count})`);
    }
};

const { seedOrgStructure } = require('../seeds/orgStructureSeed');

// connects to the postgres system DB first just to create the target database if it doesn't exist yet
const checkAndCreateDatabase = async (sequelize, databaseName) => {
    try {
        await sequelize.authenticate();

        const result = await sequelize.query(
            `SELECT 1 FROM pg_database WHERE datname = :dbname`,
            {
                replacements: { dbname: databaseName },
                type: sequelize.QueryTypes.SELECT,
            }
        );

        if (result.length === 0) {
            await sequelize.query(`CREATE DATABASE "${databaseName}"`);
            logger.info(`Database "${databaseName}" created successfully.`);
        } else {
            logger.info(`Database "${databaseName}" already exists.`);
        }
    } catch (error) {
        logger.error('Error while checking or creating database:', error.message);
    }
};

// creates the actual Sequelize connection for one of the config.postgresql entries
const createSequelizeForDatabase = async (database) => {
    // open a temporary connection to 'postgres' (the system DB) to create our DB if needed,
    // then close it so we don't leave a dangling admin connection
    const adminSequelize = new Sequelize('postgres', database.user, database.password, {
        host: database.host,
        port: database.port,
        dialect: 'postgres',
        logging: false,
        timezone: "Europe/Prague",
    });

    await checkAndCreateDatabase(adminSequelize, database.database);
    await adminSequelize.close();

    return new Sequelize(database.database, database.user, database.password, {
        host: database.host,
        port: database.port,
        dialect: 'postgres',
        logging: null,
        dialectOptions: {},
        reconnect: reconnectOptions || true,
        timezone: "Europe/Prague",
    });
};

// loops over every DB entry in config.postgresql, creates a connection,
// loads all model files from the matching models/<dbName>/ folder,
// runs sequelize.sync(), and then wires up model associations
const initDatabase = async (sequelize, database) => {
    for (const dbName of Object.keys(config.postgresql)) {
        const database = config.postgresql[dbName];

        const sequelize = await createSequelizeForDatabase(database);

        db[dbName] = sequelize;

        const modelsDir = path.join(basedir, dbName);

        try {
            fs.readdirSync(modelsDir)
                .filter(file => file.endsWith('.js') && !file.startsWith('.'))
                .forEach(file => {
                    const model = require(path.join(modelsDir, file))(sequelize, Sequelize, path.parse(file).name);
                    logger.info(`Loaded Model: ${dbName}/${file}`)
                    db[model.name] = model;
                });
        } catch (err) {
            logger.error(`Failed to load models for ${dbName}:`, err.message);
        }

        const no_force_dbs = process.env.NO_FORCE_SYNC_DB.split(',');
        let is_force_enable = process.env.FORCE_SYNC_DB === 'true';

        // individual DBs can be excluded from force sync even when FORCE_SYNC_DB is true
        if(is_force_enable && !no_force_dbs.includes(dbName) === false) {
            is_force_enable = false;
        }

        // force sync is always disabled in production regardless of env vars
        // just in case someone is not reading env comments :D
        if(process.env.NODE_ENV === 'prod' || process.env.NODE_ENV.includes("prod")) {
            is_force_enable = false;
        }

        const force_update = is_force_enable ? "on" : "off";

        logger.debug(`Force update for db "${dbName}" is ${force_update}`)

        await sequelize.sync({ force: is_force_enable, alter: is_force_enable })
            .then(() => {
                logger.info(`Database ${dbName} synchronized.`);
            })
            .catch(err => {
                logger.error(`Error synchronizing database ${dbName}:`, err.message);
            });
    }

    // run associations after all models are loaded so cross-model references work
    Object.keys(db).forEach(modelName => {
        try {
            if (db[modelName].associate) {
                db[modelName].associate(db);
            }
        } catch (err) {
            logger.error(`Error associating database, model: ${modelName}:`, err.message);
        }
    });
}

initDatabase().then(r => {
    logger.info('All databases are loaded.')

    // seed user groups from env so they exist before any user logs in
    const userGroups = process.env.TUKE_USER_GROUPS.split(',');

    for(let group of userGroups) {
        db.UsersGroups.entity({name: group }).then(r => {
            if(!r) {
                db.UsersGroups.create({name: group});
            }
        });
    }

    // seed the org unit hierarchy (faculties, departments, roles)
    seedOrgStructure(db).catch(err => {
        logger.error('Error seeding org structure:', err.message);
    });

    // make sure the process workflow template record exists in the n8n DB;
    // if it doesn't exist, create it; if it does, sync the local JSON file
    // with whatever is currently stored in the DB (so the file stays up to date)
    const filePath = path.join(__dirname, '..', 'workflows', 'processWorkflowTemplate.json');
    let processWorkflowTemplateFile = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    db.WorkflowEntities.entity({name: processWorkflowTemplateFile.name}).then(r => {
        const processWorkflowTemplate = r;
        if(!processWorkflowTemplate) {
            delete processWorkflowTemplateFile.lastUpdated;

            processWorkflowTemplateFile.name = "TemplateProcessWorkflowV2";
            processWorkflowTemplateFile.versionId = uuidv4();
            processWorkflowTemplateFile.id = nanoid(16);

            db.WorkflowEntities.create(processWorkflowTemplateFile).then(r => {
                logger.info(`Process workflow template was created`);
            }).catch(err => {
                logger.error(`Error while creating process workflow template: ${err.message}`);
            });
        } else {
            // pull current DB values back into the local file so they stay in sync
            processWorkflowTemplateFile.name = processWorkflowTemplate.dataValues.name;
            processWorkflowTemplateFile.active = processWorkflowTemplate.dataValues.active;
            processWorkflowTemplateFile.nodes = processWorkflowTemplate.dataValues.nodes;
            processWorkflowTemplateFile.connections = processWorkflowTemplate.dataValues.connections;
            processWorkflowTemplateFile.settings = processWorkflowTemplate.dataValues.settings;
            processWorkflowTemplateFile.staticData = processWorkflowTemplate.dataValues.staticData;
            processWorkflowTemplateFile.pinData = processWorkflowTemplate.dataValues.pinData;
            processWorkflowTemplateFile.versionId = processWorkflowTemplate.dataValues.versionId;
            processWorkflowTemplateFile.triggerCount = processWorkflowTemplate.dataValues.triggerCount;
            processWorkflowTemplateFile.id = processWorkflowTemplate.dataValues.id;
            processWorkflowTemplateFile.meta = processWorkflowTemplate.dataValues.meta;
            processWorkflowTemplateFile.parentFolderId = processWorkflowTemplate.dataValues.parentFolderId;
            processWorkflowTemplateFile.isArchived = processWorkflowTemplate.dataValues.isArchived;
        }

        processWorkflowTemplateFile.lastUpdated = new Date().toISOString();

        fs.writeFileSync(filePath, JSON.stringify(processWorkflowTemplateFile, null, 2), 'utf8');
    })


}).catch(err => {
    logger.error('Error while creating database:', err.message);
});


db.Sequelize = Sequelize;
module.exports = db;
