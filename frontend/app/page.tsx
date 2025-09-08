import React from 'react';
import Link from 'next/link';
import PriceChart from '../components/PriceChart';
import RecommendationCard from '../components/RecommendationCard';

export default function HomePage() {
  return (
    <main>
      <div className="mb-4">
        <p className="text-sm text-gray-600">MSTR daily price chart:</p>
      </div>
      <PriceChart />
      <div className="mt-6">
        <RecommendationCard />
      </div>
      <div className="mt-4 text-sm">
        <Link className="text-primary underline" href="/explainer">See explainer →</Link>
      </div>
    </main>
  );
}


