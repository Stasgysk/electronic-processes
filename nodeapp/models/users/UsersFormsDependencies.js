/* global routesUtils */

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
        formId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
    }, {
        tableName: "users_forms_dependencies",
        underscored: true,
        timestamps: true,
        paranoid: true,
        indexes: [
            { fields: ['user_id'] },
            { fields: ['form_id'] },
            { unique: true, fields: ['user_id', 'form_id'] },
        ],
    });

    entity.associate = (models) => {
    };


    entity.entity = async (where = null, eager = false) => {
        let include = [];

        // if(eager) {
            // include = [
            //     {
            //         model: entity.associations.Forms.target,
            //         as: 'Forms',
            //     }
            // ];
        // }

        return entity.findOne({
            include: (eager ? include : null),
            where: where,
        });
    };

    entity.entities = async (where = null, eager = false, order = [], length = 50, start = 0) => {
        let include = [];
        let attributes = null;

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