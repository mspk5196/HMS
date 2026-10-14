const branchQ = require('./branch.queries');
const { AppError } = require('../../utils/errors');

const listBranches = async () => {
  return await branchQ.listBranches();
};

const getBranchById = async (id) => {
  const branch = await branchQ.getBranchById(id);
  if (!branch) {
    throw new AppError('Branch not found', 404);
  }
  return branch;
};

const createBranch = async ({ name, code, address, phone, email }) => {
  if (!name || !code) {
    throw new AppError('Branch name and unique code are required', 400);
  }

  const existing = await branchQ.getBranchByCode(code);
  if (existing) {
    throw new AppError(`A branch with code "${code}" already exists in this organization`, 409);
  }

  return await branchQ.createBranch({ name, code, address, phone, email });
};

const updateBranch = async (id, data) => {
  await getBranchById(id);

  if (data.code) {
    const existing = await branchQ.getBranchByCode(data.code);
    if (existing && existing.id !== Number(id)) {
      throw new AppError(`A branch with code "${data.code}" already exists in this organization`, 409);
    }
  }

  return await branchQ.updateBranch(id, data);
};

const deleteBranch = async (id) => {
  await getBranchById(id);
  return await branchQ.deleteBranch(id);
};

module.exports = {
  listBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch,
};
