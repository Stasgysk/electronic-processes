/* global config */

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const basedir = path.join(__dirname, '/../models/');
const db = {};
const { v4: uuidv4 } = require('uuid');
let nanoid;
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

const createSequelizeForDatabase = async (database) => {
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

        if(is_force_enable && !no_force_dbs.includes(dbName) === false) {
            is_force_enable = false;
        }

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

    const userGroups = process.env.TUKE_USER_GROUPS.split(',');

    for(let group of userGroups) {
        db.UsersGroups.entity({name: group }).then(r => {
            if(!r) {
                db.UsersGroups.create({name: group});
            }
        });
    }

    const filePath = path.join(__dirname, '..', 'workflows', 'processWorkflowTemplate.json');
    let processWorkflowTemplateFile = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    db.WorkflowEntities.entity({name: processWorkflowTemplateFile.name}).then(r => {
        const processWorkflowTemplate = r;
        if(!processWorkflowTemplate) {
            delete processWorkflowTemplateFile.lastUpdated;

            processWorkflowTemplateFile.name = "TemplateProcessWorkflow";
            processWorkflowTemplateFile.versionId = uuidv4();
            processWorkflowTemplateFile.id = nanoid(16);

            db.WorkflowEntities.create(processWorkflowTemplateFile).then(r => {
                logger.info(`Process workflow template was created`);
            }).catch(err => {
                logger.error(`Error while creating process workflow template: ${err.message}`);
            });
        } else {
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
