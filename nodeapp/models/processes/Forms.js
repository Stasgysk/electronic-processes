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
            validate: {
                notEmpty: true,
            },
        },
        formId: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        processId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        userGroupId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        isStartingNode: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        }
    }, {
        tableName: name,
        timestamps: true,
        paranoid: true
    });

    entity.associate = (models) => {
        entity.belongsTo(models.Processes, {
            foreignKey: 'processId',
            as: 'Processes'
        });
        entity.belongsTo(models.UsersGroups, {
            foreignKey: 'userGroupId',
            as: 'UserGroup'
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