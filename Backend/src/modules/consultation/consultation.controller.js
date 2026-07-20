const service = require('./consultation.service');

const getConsultation = async (req, res, next) => {
  try {
    const data = await service.getConsultation(req.params.appointmentId);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Consultation not found' });
    }
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const saveConsultation = async (req, res, next) => {
  try {
    // req.user comes from verifyToken middleware
    const doctorId = req.user.employee_id;
    if (!doctorId) {
      return res.status(403).json({ success: false, message: 'Only registered doctors can save consultations' });
    }
    
    // Merge appointment_id from URL params if missing in body
    const data = { ...req.body, appointment_id: req.params.appointmentId || req.body.appointment_id };
    
    const result = await service.saveConsultation(data, doctorId);
    res.status(201).json(result);
  } catch (error) {
    if (error.message.includes('already exists')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

module.exports = {
  getConsultation,
  saveConsultation
};
