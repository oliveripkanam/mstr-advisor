import React from 'react';
import PriceChart from '../components/PriceChart';

export default function HomePage() {
  return (
    <main>
      <div className="mb-4">
        <p className="text-sm text-gray-600">MSTR daily price chart:</p>
      </div>
      <PriceChart />
    </main>
  );
}


