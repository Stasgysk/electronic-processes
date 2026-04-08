module.exports = (sequelize, DataTypes, name) => {
    const entity = sequelize.define(name, {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        processId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        sourceFormId: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        targetFormId: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        fieldName: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        operator: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        expectedValue: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
    }, {
        tableName: 'form_conditions',
        underscored: true,
        timestamps: true,
        paranoid: true,
        indexes: [
            { fields: ['process_id'] },
            { fields: ['source_form_id'] },
            { fields: ['target_form_id'] },
            { unique: true, fields: ['process_id', 'source_form_id', 'target_form_id'] },
        ],
    });

    entity.entity = async (where = null) => {
        return entity.findOne({ where });
    };

    entity.entities = async (where = null) => {
        return entity.findAll({ where });
    };

    return entity;
};
