const queries = require('./visiting_doctor.queries');

const list = async (search, activeOnly) => {
  return queries.listVisitingDoctors({ search, activeOnly });
};

const get = async (id) => {
  return queries.getVisitingDoctor(id);
};

const create = async (data) => {
  if (!data.full_name?.trim()) throw new Error('Doctor name is required.');
  const id = await queries.createVisitingDoctor(data);
  return queries.getVisitingDoctor(id);
};

const update = async (id, data) => {
  const existing = await queries.getVisitingDoctor(id);
  if (!existing) throw new Error('Visiting doctor not found.');
  await queries.updateVisitingDoctor(id, data);
  return queries.getVisitingDoctor(id);
};

const remove = async (id) => {
  const existing = await queries.getVisitingDoctor(id);
  if (!existing) throw new Error('Visiting doctor not found.');
  await queries.deleteVisitingDoctor(id);
};

module.exports = { list, get, create, update, remove };
