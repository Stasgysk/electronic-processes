/* global routesUtils */

module.exports = (sequelize, DataTypes, name) => {
    const entity = sequelize.define(name, {
        versionId: {
            type: DataTypes.UUID,
            primaryKey: true,
            allowNull: false,
        },
        workflowId: {
            type: DataTypes.UUID,
            primaryKey: true,
            allowNull: false,
        },
        authors: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        nodes: {
            type: DataTypes.JSON,
            allowNull: false,
        },
        connections: {
            type: DataTypes.JSON,
            allowNull: false,
        },
        name: {
            type: DataTypes.STRING(128),
            allowNull: true,
        },
        autosaved: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
    }, {
        tableName: "workflow_history",
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