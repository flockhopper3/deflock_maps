import { useEffect, useCallback } from 'react';
import { useDensityStore } from '../../store/densityStore';
import { DensityFeatureStats } from './DensityFeatureStats';

export function DensityFeaturePopup() {
  const selectedFeature = useDensityStore((s) => s.selectedFeature);
  const setSelectedFeature = useDensityStore((s) => s.setSelectedFeature);

  const handleClose = useCallback(() => {
    setSelectedFeature(null);
  }, [setSelectedFeature]);

  useEffect(() => {
    if (!selectedFeature) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedFeature, handleClose]);

  if (!selectedFeature) return null;

  return (
    <div className="absolute bottom-6 right-6 z-20 w-80 bg-dark-900/95 border border-hairline rounded-lg hidden lg:block">
      <div className="p-4">
        <DensityFeatureStats feature={selectedFeature} onClose={handleClose} />
      </div>
    </div>
  );
}
