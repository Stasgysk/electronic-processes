const cron = require('node-cron');
const { Op } = require('sequelize');

cron.schedule('0 3 * * *', async () => {
    try {
        logger.info('Cron: running expired sessions cleanup');
        const now = Date.now();

        const expiredSessions = await postgres.UsersSessions.findAll({
            where: {
                expiresAt: {
                    [Op.lt]: new Date()
                }
            }
        });

        if (expiredSessions.length > 0) {
            for (let session of expiredSessions) {
                await session.destroy();
            }
        }
        logger.info(`Cron: deleted ${expiredSessions.length} expired sessions`);
    } catch (err) {
        logger.error('Cron error (sessions cleanup):', err);
    }
},{
    timezone: "Europe/Bratislava"
});
