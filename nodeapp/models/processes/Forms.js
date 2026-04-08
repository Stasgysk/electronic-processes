module.exports = (sequelize, DataTypes, name) => {
    const entity = sequelize.define(name, {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
        },
        formName: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        formData: {
            type: DataTypes.JSON,
            allowNull: false,
        },
        formId: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        processId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        formAssigneeType: {
            type: DataTypes.ENUM('group', 'shared_emails', 'individual_emails', 'role', 'action'),
            allowNull: false,
        },
        formType: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'form',
        },
        actionWorkflowNodes: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        isStartingNode: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        }
    }, {
        tableName: "forms",
        underscored: true,
        timestamps: true,
        paranoid: true,
        indexes: [
            { fields: ['form_id'] },
            { fields: ['process_id'] },
            { fields: ['is_starting_node'] },
        ],
    });

    entity.associate = (models) => {
        entity.belongsTo(models.Processes, {
            foreignKey: 'processId',
            as: 'Processes'
        });
        entity.belongsToMany(entity, {
            through: models.FormsDependencies,
            as: 'PreviousForms',
            foreignKey: 'formId',
            otherKey: 'prevFormId',
            sourceKey: 'formId',
            targetKey: 'formId'
        });

        entity.belongsToMany(entity, {
            through: models.FormsDependencies,
            as: 'NextForms',
            foreignKey: 'prevFormId',
            otherKey: 'formId',
            sourceKey: 'formId',
            targetKey: 'formId'
        });

        entity.hasMany(models.FormsAssignees, {
            foreignKey: 'formId',
            as: 'FormsAssignees',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
        });
    };


    entity.entity = async (where = null, eager = false) => {
        const { FormsAssignees, Processes } = sequelize.models;
        return entity.findOne({
            where,
            include: eager ? [
                { model: FormsAssignees, as: 'FormsAssignees' },
                { model: Processes, as: 'Processes' },
            ] : undefined,
        });
    };

    entity.entities = async (where = null, eager = false, order = [], length = 50, start = 0) => {
        const { FormsAssignees, Processes } = sequelize.models;
        return entity.findAll({
            where,
            include: eager ? [
                { model: FormsAssignees, as: 'FormsAssignees' },
                { model: Processes, as: 'Processes' },
            ] : undefined,
            limit: length ? parseInt(length) : undefined,
            offset: parseInt(start),
            order: [['updatedAt', 'DESC']],
        });
    };


    return entity;
};