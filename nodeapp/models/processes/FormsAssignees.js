module.exports = (sequelize, DataTypes, name) => {
    const entity = sequelize.define(name, {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
        },
        formId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        userGroupId: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        accompanyingText: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
    }, {
        tableName: "forms_assignees",
        underscored: true,
        timestamps: true,
        paranoid: true,
        indexes: [
            { fields: ['form_id'] },
            { fields: ['user_id'] },
            { fields: ['user_group_id'] },
        ],
    });

    entity.associate = (models) => {
        entity.belongsTo(models.Forms, {
            foreignKey: 'formId',
            as: 'Form'
        });
        entity.belongsTo(models.Users, {
            foreignKey: 'userId',
            as: 'User'
        });
        entity.belongsTo(models.UsersGroups, {
            foreignKey: 'userGroupId',
            as: 'UserGroup'
        });
    };


    entity.entity = async (where = null, eager = false) => {
        let include = [];

        // if(eager) {
        //     include = [
        //         {
        //             model: entity.associations.Forms.target,
        //             as: 'Forms',
        //         }
        //     ];
        // }

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