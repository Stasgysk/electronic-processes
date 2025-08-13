/* global routesUtils */

module.exports = (sequelize, DataTypes, name) => {
    const entity = sequelize.define(name, {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
        },
        formData: {
            type: DataTypes.JSON,
            allowNull: false,
            validate: {
                notEmpty: true,
            },
        },
        formStatusId: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        status: {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue: 0,
        },
        formId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        filledUserId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: -1,
        },
        webhookUrl: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        processStatusId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        }
    }, {
        tableName: name,
        timestamps: true,
        paranoid: true,
    });

    entity.associate = (models) => {
        entity.belongsTo(models.ProcessesStatuses, {
            foreignKey: 'formStatusId',
            as: 'processStatus'
        });
        entity.belongsTo(models.Forms, {
            foreignKey: 'formId',
            as: 'form'
        });
        entity.belongsTo(models.Users, {
            foreignKey: 'filledUserId',
            as: 'user'
        });
    };


    entity.entity = async (where = null, eager = false) => {
        let include = [];

        if(eager) {
            include = [
                {
                    model: entity.associations.processStatus.target,
                    as: 'processStatus',
                },
                {
                    model: entity.associations.form.target,
                    as: 'form',
                },
                {
                    model: entity.associations.user.target,
                    as: 'user',
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
                    model: entity.associations.processStatus.target,
                    as: 'processStatus',
                },
                {
                    model: entity.associations.form.target,
                    as: 'form',
                },
                {
                    model: entity.associations.user.target,
                    as: 'user',
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