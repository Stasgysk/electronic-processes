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
            type: DataTypes.STRING,
            allowNull: true,
            unique: true
        },
        userGroupId: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        email: {
            type: DataTypes.TEXT,
            allowNull: false,
            unique: true,
        },
        orgUnitId: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
    }, {
        tableName: "users",
        underscored: true,
        timestamps: true,
        paranoid: true,
        indexes: [
            { unique: true, fields: ['name'] },
            { unique: true, fields: ['email'] },
            { fields: ['user_group_id'] },
        ],
    });

    entity.associate = (models) => {
        entity.belongsTo(models.UsersGroups, {
            foreignKey: 'userGroupId',
            as: 'UsersGroups',
        });
        entity.belongsTo(models.OrgUnits, {
            foreignKey: 'orgUnitId',
            as: 'OrgUnit',
        });
        entity.hasMany(models.UserWorkplaces, {
            foreignKey: 'userId',
            as: 'UserWorkplaces',
        });
        entity.hasMany(models.UserOrgRoles, {
            foreignKey: 'userId',
            as: 'UserOrgRoles',
        });
    };


    entity.entity = async (where = null, eager = false) => {
        const { UsersGroups } = sequelize.models;
        return entity.findOne({
            include: eager ? [
                { model: UsersGroups, as: 'UsersGroups' },
            ] : undefined,
            where: where,
        });
    };

    entity.entities = async (where = null, eager = false, order = [], length = 50, start = 0) => {
        let include = [];
        let attributes = null;

        // if(eager) {
        //     include = [
        //         {
        //             model: entity.associations.Organization.target, // Access the target model via associations
        //             as: 'Organization',
        //         }
        //     ];
        // }

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