module.exports = (sequelize, DataTypes, name) => {
    const entity = sequelize.define(name, {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
        },
        orgUnitId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        name: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        emailPattern: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        accessCode: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        isStudentRole: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        sortOrder: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
    }, {
        tableName: "org_roles",
        underscored: true,
        timestamps: true,
        paranoid: true,
        indexes: [
            { fields: ['org_unit_id'] },
        ],
    });

    entity.associate = (models) => {
        entity.belongsTo(models.OrgUnits, {
            foreignKey: 'orgUnitId',
            as: 'OrgUnit',
        });
        entity.hasMany(models.UserOrgRoles, {
            foreignKey: 'orgRoleId',
            as: 'UserOrgRoles',
        });
    };

    entity.entity = async (where = null, eager = false) => {
        const { UserOrgRoles, Users } = sequelize.models;
        return entity.findOne({
            where,
            include: eager ? [{
                model: UserOrgRoles,
                as: 'UserOrgRoles',
                include: [{ model: Users, as: 'User' }],
            }] : undefined,
        });
    };

    entity.entities = async (where = null, eager = false, order = [], length = 500, start = 0) => {
        const { UserOrgRoles, Users } = sequelize.models;
        return entity.findAll({
            where,
            include: eager ? [{
                model: UserOrgRoles,
                as: 'UserOrgRoles',
                include: [{ model: Users, as: 'User' }],
            }] : undefined,
            limit: length ? parseInt(length) : undefined,
            offset: parseInt(start),
            order: [['name', 'ASC']],
        });
    };

    return entity;
};
