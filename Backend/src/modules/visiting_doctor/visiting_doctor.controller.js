const service = require('./visiting_doctor.service');

const list = async (req, res, next) => {
  try {
    const { search, activeOnly } = req.query;
    const data = await service.list(search, activeOnly !== 'false');
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const get = async (req, res, next) => {
  try {
    const data = await service.get(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Visiting doctor not found.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const data = await service.create(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const data = await service.update(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await service.remove(req.params.id);
    res.json({ success: true, message: 'Visiting doctor deactivated.' });
  } catch (err) { next(err); }
};

module.exports = { list, get, create, update, remove };
