/* global routesUtils */

module.exports = (sequelize, DataTypes, name) => {
    const entity = sequelize.define(name, {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: DataTypes.TEXT,
            allowNull: false,
            validate: {
                notEmpty: true,
            },
            unique: true
        },
        status: {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue: 0
        },
        processGroupId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        processTypeId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        }
    }, {
        tableName: name,
        timestamps: true,
        paranoid: true
    });

    entity.associate = (models) => {
        entity.belongsTo(models.ProcessesGroups, {
            foreignKey: 'processGroupId',
            as: 'processGroup'
        });
        entity.belongsTo(models.ProcessesTypes, {
            foreignKey: 'processTypeId',
            as: 'processType'
        });
    };


    entity.entity = async (where = null, eager = false) => {
        let include = [];

        if(eager) {
            include = [
                {
                    model: entity.associations.processGroup.target,
                    as: 'processGroup',
                },
                {
                    model: entity.associations.processType.target,
                    as: 'processType',
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

        if(eager) {
            include = [
                {
                    model: entity.associations.processGroup.target,
                    as: 'processGroup',
                },
                {
                    model: entity.associations.processType.target,
                    as: 'processType',
                }
            ];
        }

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