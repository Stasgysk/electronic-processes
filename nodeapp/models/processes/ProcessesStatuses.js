/* global routesUtils */

module.exports = (sequelize, DataTypes, name) => {
    const entity = sequelize.define(name, {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
        },
        processId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        status: {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue: 0
        },
        initUserId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
    }, {
        tableName: name,
        timestamps: true,
        paranoid: true
    });

    entity.associate = (models) => {
        entity.belongsTo(models.Users, {
            foreignKey: 'initUserId',
            as: 'Users'
        });
        entity.belongsTo(models.Processes, {
            foreignKey: 'processId',
            as: 'Processes'
        });
    };


    entity.entity = async (where = null, eager = false) => {
        let include = [];

        if(eager) {
            include = [
                {
                    model: entity.associations.Users.target,
                    as: 'Users',
                }
            ];
        }

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