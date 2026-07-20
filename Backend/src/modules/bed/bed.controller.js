const queries = require('./bed.queries');
const asyncHandler = require('../../middleware/asyncHandler');
const { success } = require('../../utils/response');

const getWards = asyncHandler(async (req, res) => {
  const wards = await queries.getWards();
  res.json(success(wards));
});

const getRooms = asyncHandler(async (req, res) => {
  const rooms = await queries.getRooms(req.params.wardId);
  res.json(success(rooms));
});

const getBeds = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const beds = await queries.getBeds(req.params.roomId, status);
  res.json(success(beds));
});

const getAllBeds = asyncHandler(async (req, res) => {
  const beds = await queries.getAllBeds();
  res.json(success(beds));
});

module.exports = {
  getWards,
  getRooms,
  getBeds,
  getAllBeds
};
