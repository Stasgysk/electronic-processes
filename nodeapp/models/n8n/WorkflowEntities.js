/* global routesUtils */

module.exports = (sequelize, DataTypes, name) => {
    const entity = sequelize.define(name, {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false,
        },
        name: {
            type: DataTypes.STRING(128),
            allowNull: false,
        },
        active: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        nodes: {
            type: DataTypes.JSON,
            allowNull: false,
        },
        connections: {
            type: DataTypes.JSON,
            allowNull: false,
        },
        settings: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        staticData: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        pinData: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        versionId: {
            type: DataTypes.STRING(36),
            allowNull: true,
        },
        triggerCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        meta: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        parentFolderId: {
            type: DataTypes.STRING(36),
            allowNull: true,
        },
        isArchived: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
    }, {
        tableName: "workflow_entity",
        schema: 'public',
        timestamps: true,
    });


    entity.entity = async (where = null, eager = false) => {
        let include = [];

        return entity.findOne({
            include: (eager ? include : null),
            where: where,
        });
    };

    entity.entities = async (where = null, eager = false, order = [], length = 50, start = 0) => {
        let include = [];
        let attributes = null;

        return entity.findAll({
            where: where,
            limit: (!length?null:parseInt(length)),
            offset: parseInt(start),
            include: (eager ? include : null),
            order: [
                ['updatedAt', 'DESC'],
            ],
        });
    };

    return entity;
};