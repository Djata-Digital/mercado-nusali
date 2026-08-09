import React from 'react';
import { Link } from 'react-router-dom';

type Props = {
  title: string;
  description: string;
};

export function FeatureUnavailablePage({
  title,
  description,
}: Props) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-3 text-sm text-gray-600">
        {description}
      </p>
      <Link
        to="/"
        className="mt-6 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
      >
        Voltar ao Mercado Nusali
      </Link>
    </main>
  );
}
