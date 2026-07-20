import React from 'react';

export default function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-gray-400 font-medium mb-1">
          Admin &nbsp;&gt;&nbsp; <span className="text-gray-700 font-semibold">Settings</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">System Settings & Configuration</h1>
        <p className="text-xs text-gray-500 mt-0.5">Configure hospital branding, SMS gateway, backup schedules, and printers.</p>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-200/80 shadow-sm space-y-6">
        <h2 className="text-sm font-bold text-gray-900">Hospital Profile</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-bold text-gray-700 mb-1">Hospital Name</label>
            <input type="text" defaultValue="Neha Hospital" className="w-full p-2.5 border border-gray-200 rounded-lg" />
          </div>
          <div>
            <label className="block font-bold text-gray-700 mb-1">Tagline</label>
            <input type="text" defaultValue="Hospital Management System v2.0" className="w-full p-2.5 border border-gray-200 rounded-lg" />
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100 flex justify-end">
          <button className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm cursor-pointer transition-colors">
            Save System Settings
          </button>
        </div>
      </div>
    </div>
  );
}
