module.exports = (sequelize, DataTypes, name) => {
    const entity = sequelize.define(name, {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        orgRoleId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
    }, {
        tableName: "user_org_roles",
        underscored: true,
        timestamps: true,
        paranoid: true,
        indexes: [
            { fields: ['user_id'] },
            { fields: ['org_role_id'] },
        ],
    });

    entity.associate = (models) => {
        entity.belongsTo(models.Users, {
            foreignKey: 'userId',
            as: 'User',
        });
        entity.belongsTo(models.OrgRoles, {
            foreignKey: 'orgRoleId',
            as: 'OrgRole',
        });
    };

    entity.entity = async (where = null, eager = false) => {
        const { Users, OrgRoles } = sequelize.models;
        return entity.findOne({
            where,
            include: eager ? [
                { model: Users, as: 'User' },
                { model: OrgRoles, as: 'OrgRole' },
            ] : undefined,
        });
    };

    entity.entities = async (where = null, eager = false, order = [], length = 500, start = 0) => {
        const { Users, OrgRoles } = sequelize.models;
        return entity.findAll({
            where,
            include: eager ? [
                { model: Users, as: 'User' },
                { model: OrgRoles, as: 'OrgRole' },
            ] : undefined,
            limit: length ? parseInt(length) : undefined,
            offset: parseInt(start),
            order: [['createdAt', 'DESC']],
        });
    };

    return entity;
};
