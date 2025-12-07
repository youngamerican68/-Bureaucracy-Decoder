'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Building2, FileText, Search, ArrowRight, Plus, MapPin, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { featuredMetros, getMetrosByRegion } from '@/lib/featured-metros';
import type { FeaturedMetro } from '@/types';

export default function LandingPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const metrosByRegion = getMetrosByRegion();

  const handleMetroClick = (metro: FeaturedMetro, e: React.MouseEvent) => {
    if (metro.status === 'coming_soon') {
      e.preventDefault();
      setToastMessage(`${metro.cityName} coming in Q3. Added to your wishlist.`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const filteredMetros = searchQuery
    ? featuredMetros.filter(
        (m) =>
          m.cityName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.region.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : featuredMetros;

  const regions = Object.keys(metrosByRegion).sort();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            <span className="font-semibold text-lg">Bureaucracy Decoder</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/analyze" className="text-sm text-muted-foreground hover:text-foreground">
              Analyze
            </Link>
            <Link href="/ingest" className="text-sm text-muted-foreground hover:text-foreground">
              Add Code
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          Turn Zoning Text Spaghetti into
          <br />
          <span className="text-primary">Pre-Approval Packets</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Inspired by Vulcan Technologies. Use AI to parse 400+ years of
          regulatory text and get citation-backed zoning analyses in minutes.
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/analyze">
            <Button size="lg">
              Start Analysis
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/ingest">
            <Button variant="outline" size="lg">
              <Plus className="mr-2 h-4 w-4" />
              Add Custom Code
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <FileText className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>Pre-Approval Packets</CardTitle>
              <CardDescription>
                Get structured compliance analyses with use, height, setbacks,
                parking, and more - all with specific code citations.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <Search className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>Ask the Code</CardTitle>
              <CardDescription>
                Query any zoning code in natural language and receive
                citation-backed answers using RAG and Claude.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <MapPin className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>50 Major Metros</CardTitle>
              <CardDescription>
                Pre-loaded with zoning codes from 50 major US metropolitan
                areas. Add your own jurisdictions anytime.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Featured Metros */}
      <section className="container mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold mb-2">Featured Metropolitan Codes</h2>
            <p className="text-muted-foreground">
              Select a city to start analyzing its zoning code
            </p>
          </div>
          <div className="mt-4 md:mt-0 w-full md:w-64">
            <Input
              placeholder="Search cities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {searchQuery ? (
          // Flat list when searching
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredMetros.map((metro) => {
              const isActive = metro.status === 'active';
              return (
                <Link
                  key={metro.slug}
                  href={isActive ? `/analyze?city=${metro.slug}` : '#'}
                  className="block"
                  onClick={(e) => handleMetroClick(metro, e)}
                >
                  <Card className={`transition-colors h-full ${
                    isActive
                      ? 'hover:border-primary cursor-pointer border-primary/20'
                      : 'opacity-60 cursor-not-allowed'
                  }`}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="font-medium">{metro.cityName}</div>
                        {isActive ? (
                          <div className="flex items-center gap-1 text-xs text-green-500 flex-shrink-0">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            Live
                          </div>
                        ) : (
                          <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {metro.codeName}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {metro.region}
                      </div>
                      {!isActive && (
                        <div className="text-xs text-amber-500 mt-2">Coming Soon</div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          // Grouped by region when not searching
          <div className="space-y-8">
            {regions.map((region) => (
              <div key={region}>
                <h3 className="text-lg font-semibold mb-4">{region}</h3>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {metrosByRegion[region].map((metro) => {
                    const isActive = metro.status === 'active';
                    return (
                      <Link
                        key={metro.slug}
                        href={isActive ? `/analyze?city=${metro.slug}` : '#'}
                        className="block"
                        onClick={(e) => handleMetroClick(metro, e)}
                      >
                        <Card className={`transition-colors h-full ${
                          isActive
                            ? 'hover:border-primary cursor-pointer border-primary/20'
                            : 'opacity-60 cursor-not-allowed'
                        }`}>
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="font-medium">{metro.cityName}</div>
                              {isActive ? (
                                <div className="flex items-center gap-1 text-xs text-green-500 flex-shrink-0">
                                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                  Live
                                </div>
                              ) : (
                                <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground truncate">
                              {metro.codeName}
                            </div>
                            {!isActive && (
                              <div className="text-xs text-amber-500 mt-2">Coming Soon</div>
                            )}
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Disclaimer */}
      <section className="container mx-auto px-4 py-8 border-t">
        <p className="text-sm text-muted-foreground text-center max-w-3xl mx-auto">
          <strong>Disclaimer:</strong> This tool provides structured analyses of
          zoning codes using AI. It is not legal advice. Always consult a
          licensed professional and the official municipal code before making
          any development decisions.
        </p>
      </section>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 bg-card border border-border rounded-lg shadow-lg p-4 max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
          <p className="text-sm">{toastMessage}</p>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Bureaucracy Decoder - Inspired by Vulcan Technologies
        </div>
      </footer>
    </div>
  );
}
