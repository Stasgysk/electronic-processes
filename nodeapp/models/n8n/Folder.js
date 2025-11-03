/* global routesUtils */

module.exports = (sequelize, DataTypes, name) => {
    const entity = sequelize.define(name, {
        id: {
            type: DataTypes.TEXT,
            primaryKey: true,
            allowNull: false,
        },
        name: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        parentFolderId: {
            type: DataTypes.TEXT,
            allowNull: true,
            defaultValue: null,
        },
        projectId: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
    }, {
        tableName: "folder",
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