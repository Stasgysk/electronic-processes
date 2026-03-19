module.exports = (sequelize, DataTypes, name) => {
    const entity = sequelize.define(name, {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        orgUnitId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
    }, {
        tableName: "user_workplaces",
        underscored: true,
        timestamps: true,
        paranoid: true,
        indexes: [
            { fields: ['user_id'] },
            { fields: ['org_unit_id'] },
        ],
    });

    entity.associate = (models) => {
        entity.belongsTo(models.Users, { foreignKey: 'userId', as: 'User' });
        entity.belongsTo(models.OrgUnits, { foreignKey: 'orgUnitId', as: 'OrgUnit' });
    };

    entity.entity = async (where = null) => entity.findOne({ where, include: [{ model: sequelize.models.OrgUnits, as: 'OrgUnit' }] });
    entity.entities = async (where = null) => entity.findAll({ where, include: [{ model: sequelize.models.OrgUnits, as: 'OrgUnit' }] });

    return entity;
};
