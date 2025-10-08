module.exports = (sequelize, DataTypes, name) => {
    const entity = sequelize.define(name, {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
        },
        processId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        formId: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        prevFormId: {
            type: DataTypes.TEXT,
            allowNull: false,
        }
    }, {
        tableName: "forms_dependencies",
        underscored: true,
        timestamps: true,
        paranoid: true,
        indexes: [
            { fields: ['process_id'] },
            { fields: ['form_id'] },
            { fields: ['prev_form_id'] },
            { unique: true, fields: ['process_id', 'form_id', 'prev_form_id'] },
        ],
    });

    entity.entity = async (where = null, eager = false) => {
        let include = [];

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