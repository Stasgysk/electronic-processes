/* global routesUtils */

module.exports = (sequelize, DataTypes, name) => {
    const entity = sequelize.define(name, {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
        },
        sessionId: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            allowNull: false,
            unique: true,
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        refreshToken: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        userAgent: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        ipPrefix: {
            type: DataTypes.INET,
            allowNull: false,
        },
        csrfSecret: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        expiresAt: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    }, {
        tableName: "users_sessions",
        underscored: true,
        timestamps: true,
        paranoid: true,
        indexes: [
            { fields: ['user_id'] },
            { fields: ['session_id'], unique: true },
            { fields: ['expires_at'] },
        ]
    });

    entity.associate = (models) => {
        entity.belongsTo(models.Users, {
            foreignKey: 'userId',
            as: 'user',
        });
    };


    entity.entity = async (where = null, eager = false) => {
        let include = [];

        if(eager) {
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