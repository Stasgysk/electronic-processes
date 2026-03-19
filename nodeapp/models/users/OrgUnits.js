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
        },
        type: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        parentId: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        studentPickable: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
    }, {
        tableName: "org_units",
        underscored: true,
        timestamps: true,
        paranoid: true,
        indexes: [
            { fields: ['parent_id'] },
        ],
    });

    entity.associate = (models) => {
        entity.belongsTo(entity, {
            foreignKey: 'parentId',
            as: 'Parent',
        });
        entity.hasMany(entity, {
            foreignKey: 'parentId',
            as: 'Children',
        });
        entity.hasMany(models.OrgRoles, {
            foreignKey: 'orgUnitId',
            as: 'OrgRoles',
        });
        entity.hasMany(models.Users, {
            foreignKey: 'orgUnitId',
            as: 'Users',
        });
        entity.hasMany(models.UserWorkplaces, {
            foreignKey: 'orgUnitId',
            as: 'UserWorkplaces',
        });
    };

    entity.entity = async (where = null, eager = false) => {
        return entity.findOne({ where });
    };

    entity.entities = async (where = null, eager = false, order = [], length = 1000, start = 0) => {
        return entity.findAll({
            where,
            limit: length ? parseInt(length) : undefined,
            offset: parseInt(start),
            order: [['name', 'ASC']],
        });
    };

    return entity;
};
