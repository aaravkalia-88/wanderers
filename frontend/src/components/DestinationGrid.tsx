import React, { useEffect, useState } from 'react';
import { getDestinations, Destination } from '../api/destinations';
import DestinationCard from './DestinationCard';

interface Props {
  mood: string;
}

const DestinationGrid: React.FC<Props> = ({ mood }) => {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDestinations = async () => {
      setLoading(true);
      try {
        const data = await getDestinations(mood);
        setDestinations(data);
      } catch (error) {
        console.error("Failed to load destinations", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDestinations();
  }, [mood]);

  if (loading) {
    return <div className="py-20 text-center text-[#475569] dark:text-[#94A3B8] animate-pulse">Consulting the maps...</div>;
  }

  if (destinations.length === 0) {
    return <div className="py-20 text-center text-[#475569] dark:text-[#94A3B8]">No hidden gems found for this vibe.</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {destinations.map(dest => (
        <DestinationCard key={dest.id} p={dest} busy={false} onOpen={() => { window.location.href = `/places/${dest.id}`; }} onSave={() => { window.location.href = `/places/${dest.id}`; }} />
      ))}
    </div>
  );
};

export default DestinationGrid;
