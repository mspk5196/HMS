const asyncHandler = require('../../middleware/asyncHandler');
const { success } = require('../../utils/response');
const service = require('./audit.service');

const listLogs = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 50,
    search = '',
    method = '',
    statusGroup = '',
    statusCode = '',
    startDate = '',
    endDate = '',
    role = '',
  } = req.query;

  const result = await service.listLogs({
    page,
    limit,
    search,
    method,
    statusGroup,
    statusCode,
    startDate,
    endDate,
    role,
  });

  return res.status(200).json(success(result));
});

const getStats = asyncHandler(async (req, res) => {
  const stats = await service.getStats();
  return res.status(200).json(success(stats));
});

module.exports = {
  listLogs,
  getStats,
};
