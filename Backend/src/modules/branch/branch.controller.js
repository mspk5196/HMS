const branchSvc = require('./branch.service');
const asyncHandler = require('../../middleware/asyncHandler');
const { success, created } = require('../../utils/response');

const listBranches = asyncHandler(async (req, res) => {
  const branches = await branchSvc.listBranches();
  return res.json(success(branches, 'Branches fetched successfully'));
});

const getBranch = asyncHandler(async (req, res) => {
  const branch = await branchSvc.getBranchById(req.params.id);
  return res.json(success(branch, 'Branch details fetched successfully'));
});

const createBranch = asyncHandler(async (req, res) => {
  const branch = await branchSvc.createBranch(req.body);
  return res.status(201).json(created(branch, 'Branch created successfully'));
});

const updateBranch = asyncHandler(async (req, res) => {
  const updated = await branchSvc.updateBranch(req.params.id, req.body);
  return res.json(success(updated, 'Branch updated successfully'));
});

const deleteBranch = asyncHandler(async (req, res) => {
  await branchSvc.deleteBranch(req.params.id);
  return res.json(success(null, 'Branch deactivated successfully'));
});

module.exports = {
  listBranches,
  getBranch,
  createBranch,
  updateBranch,
  deleteBranch,
};
