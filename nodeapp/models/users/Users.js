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
            allowNull: false,
        },
        email: {
            type: DataTypes.TEXT,
            allowNull: false,
            unique: true,
        }
    }, {
        tableName: name,
        timestamps: true,
        paranoid: true
    });

    entity.associate = (models) => {
        entity.belongsTo(models.UsersGroups, {
            foreignKey: 'userGroupId',
            as: 'UsersGroups',
        });
    };


    entity.entity = async (where = null, eager = false) => {
        let include = [];

        if(eager) {
            // include = [
            //     {
            //         model: entity.associations.Organization.target, // Access the target model via associations
            //         as: 'Organization',
            //     }
            // ];
        }
        return entity.findOne({
            include: (eager ? include : null),
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