const aiService = require('./roster.ai.service');

const getAiHealth = async (req, res, next) => {
  try {
    const data = await aiService.checkAiHealth();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

const listTemplates = async (req, res, next) => {
  try {
    const { department_id, staff_role_id, include_all } = req.query;
    const includeAllBool = include_all === 'true' || include_all === '1';
    const data = await aiService.listRuleTemplates(department_id, staff_role_id, includeAllBool);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

const createTemplate = async (req, res, next) => {
  try {
    const data = await aiService.createRuleTemplate(req.body, req.user?.id);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

const updateTemplate = async (req, res, next) => {
  try {
    const data = await aiService.updateRuleTemplate(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

const deleteTemplate = async (req, res, next) => {
  try {
    const data = await aiService.deleteRuleTemplate(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

const generateRoster = async (req, res, next) => {
  try {
    const data = await aiService.generateAiRoster(req.body, req.user?.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

const approveRoster = async (req, res, next) => {
  try {
    const { generation_id, assignments } = req.body;
    const data = await aiService.approveAiRoster(generation_id, assignments, req.user?.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAiHealth,
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  generateRoster,
  approveRoster
};
