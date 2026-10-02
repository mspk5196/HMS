import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../util/api';

const DEFAULT_PROFILE = {
  HOSPITAL_NAME: 'Neha Hospitals',
  HOSPITAL_SUBTITLE: 'Speciality Hospital for Gynecology & Maternity · Pediatrics, Orthopedics & Gut Care',
  HOSPITAL_ADDRESS: '47, South Park Street (Kambar Veethi, Ganga Nagar), Kutchery Medu, Gobichettipalayam, Tamil Nadu - 638452',
  HOSPITAL_PHONE: '04285 - 222333',
  HOSPITAL_EMERGENCY: '+91 97894 94444',
  HOSPITAL_EMAIL: 'contact@nehahospitals.com',
  HOSPITAL_WEBSITE: 'www.nehahospitals.com',
  HOSPITAL_GSTIN: '33AAAAA0000A1Z5',
  HOSPITAL_REG_NO: 'Reg. No: NH/TN/638452 | NABH Entry-Level Accredited',
  HOSPITAL_HEADER_NOTE: '24x7 Emergency, Trauma, Critical Care & Pharmacy Services',
  HOSPITAL_LOGO_PATH: '',
  HOSPITAL_LOGO_DATA: '',
};

const HospitalProfileContext = createContext({
  profile: DEFAULT_PROFILE,
  isLoading: false,
  refreshProfile: async () => {},
  hospitalName: DEFAULT_PROFILE.HOSPITAL_NAME,
  hospitalSubtitle: DEFAULT_PROFILE.HOSPITAL_SUBTITLE,
  hospitalAddress: DEFAULT_PROFILE.HOSPITAL_ADDRESS,
  hospitalPhone: DEFAULT_PROFILE.HOSPITAL_PHONE,
  hospitalEmergency: DEFAULT_PROFILE.HOSPITAL_EMERGENCY,
  hospitalEmail: DEFAULT_PROFILE.HOSPITAL_EMAIL,
  hospitalWebsite: DEFAULT_PROFILE.HOSPITAL_WEBSITE,
  hospitalGstin: DEFAULT_PROFILE.HOSPITAL_GSTIN,
  hospitalRegNo: DEFAULT_PROFILE.HOSPITAL_REG_NO,
  hospitalHeaderNote: DEFAULT_PROFILE.HOSPITAL_HEADER_NOTE,
  hospitalLogo: '',
});

export function HospitalProfileProvider({ children }) {
  const [profile, setProfile] = useState(() => {
    try {
      const cached = localStorage.getItem('nh_hospital_profile');
      if (cached) {
        return { ...DEFAULT_PROFILE, ...JSON.parse(cached) };
      }
    } catch (_) {}
    return DEFAULT_PROFILE;
  });

  const [isLoading, setIsLoading] = useState(false);

  const refreshProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiFetch('/system/hospital-profile');
      const data = res?.data || res;
      if (data && typeof data === 'object') {
        const merged = { ...DEFAULT_PROFILE, ...data };
        setProfile(merged);
        try {
          localStorage.setItem('nh_hospital_profile', JSON.stringify(merged));
          window.dispatchEvent(new CustomEvent('hospital-profile-updated', { detail: merged }));
        } catch (_) {}
      }
    } catch (err) {
      // Fallback silently if offline or token not yet set
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();

    // Listen for updates from other tabs or components
    const handleStorageOrEvent = (e) => {
      if (e.type === 'hospital-profile-updated' && e.detail) {
        setProfile((prev) => ({ ...prev, ...e.detail }));
      }
    };

    window.addEventListener('hospital-profile-updated', handleStorageOrEvent);
    return () => {
      window.removeEventListener('hospital-profile-updated', handleStorageOrEvent);
    };
  }, [refreshProfile]);

  // Derived logo URL (data URI takes priority for fast/offline rendering, followed by static uploads URL)
  const hospitalLogo = useMemo(() => {
    if (profile.HOSPITAL_LOGO_DATA) {
      return profile.HOSPITAL_LOGO_DATA;
    }
    if (profile.HOSPITAL_LOGO_PATH) {
      const path = profile.HOSPITAL_LOGO_PATH;
      if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
        return path;
      }
      // If relative path like /uploads/..., resolve against backend URL
      const apiUrl = import.meta.env.VITE_API_URL || '/api';
      const baseUrl = apiUrl.replace(/\/api\/?$/, '');
      return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    }
    return '';
  }, [profile.HOSPITAL_LOGO_DATA, profile.HOSPITAL_LOGO_PATH]);

  // Synchronize browser tab favicon and document title with hospital profile
  useEffect(() => {
    if (hospitalLogo) {
      try {
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.head.appendChild(link);
        }
        link.href = hospitalLogo;

        let appleLink = document.querySelector("link[rel='apple-touch-icon']");
        if (!appleLink) {
          appleLink = document.createElement('link');
          appleLink.rel = 'apple-touch-icon';
          document.head.appendChild(appleLink);
        }
        appleLink.href = hospitalLogo;
      } catch (_) {}
    }

    if (profile.HOSPITAL_NAME) {
      try {
        document.title = `${profile.HOSPITAL_NAME} - Management System`;
      } catch (_) {}
    }
  }, [hospitalLogo, profile.HOSPITAL_NAME]);

  const value = useMemo(() => ({
    profile,
    isLoading,
    refreshProfile,
    hospitalName: profile.HOSPITAL_NAME || DEFAULT_PROFILE.HOSPITAL_NAME,
    hospitalSubtitle: profile.HOSPITAL_SUBTITLE || '',
    hospitalAddress: profile.HOSPITAL_ADDRESS || '',
    hospitalPhone: profile.HOSPITAL_PHONE || '',
    hospitalEmergency: profile.HOSPITAL_EMERGENCY || '',
    hospitalEmail: profile.HOSPITAL_EMAIL || '',
    hospitalWebsite: profile.HOSPITAL_WEBSITE || '',
    hospitalGstin: profile.HOSPITAL_GSTIN || '',
    hospitalRegNo: profile.HOSPITAL_REG_NO || '',
    hospitalHeaderNote: profile.HOSPITAL_HEADER_NOTE || '',
    hospitalLogo,
  }), [profile, isLoading, refreshProfile, hospitalLogo]);

  return (
    <HospitalProfileContext.Provider value={value}>
      {children}
    </HospitalProfileContext.Provider>
  );
}

export function useHospitalProfile() {
  return useContext(HospitalProfileContext);
}

export default HospitalProfileContext;
