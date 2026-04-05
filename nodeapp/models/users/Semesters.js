module.exports = (sequelize, DataTypes, name) => {
    const entity = sequelize.define(name, {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        name: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        type: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        academicYear: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        startDate: {
            type: DataTypes.DATEONLY,
            allowNull: false,
        },
        endDate: {
            type: DataTypes.DATEONLY,
            allowNull: false,
        },
        isCurrent: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
    }, {
        tableName: 'semesters',
        underscored: true,
        timestamps: true,
        paranoid: true,
    });

    entity.associate = (models) => {
        entity.hasMany(models.UserOrgRoles, {
            foreignKey: 'semesterId',
            as: 'UserOrgRoles',
        });
    };

    entity.entity = async (where = null) => {
        return entity.findOne({ where });
    };

    entity.entities = async (where = null, length = 100, start = 0) => {
        return entity.findAll({
            where,
            limit: length ? parseInt(length) : undefined,
            offset: parseInt(start),
            order: [['start_date', 'DESC']],
        });
    };

    return entity;
};
