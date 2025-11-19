'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Building2, Upload, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function IngestPage() {
  const [formData, setFormData] = useState({
    cityName: '',
    codeName: '',
    region: '',
    sourceUrl: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const generateSlug = (cityName: string, codeName: string) => {
    return `${cityName}-${codeName}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: generateSlug(formData.cityName, formData.codeName),
          cityName: formData.cityName,
          codeName: formData.codeName,
          region: formData.region || undefined,
          sourceUrl: formData.sourceUrl,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start ingestion');
      }

      const data = await response.json();
      setSuccess(data.message);
      setFormData({ cityName: '', codeName: '', region: '', sourceUrl: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            <span className="font-semibold text-lg">Bureaucracy Decoder</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Home
            </Link>
            <Link
              href="/analyze"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Analyze
            </Link>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Add Custom Zoning Code</CardTitle>
            <CardDescription>
              Ingest a zoning code from any municipality not in our featured
              list. The system will crawl the URL, extract text, and create
              searchable embeddings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="cityName">City Name *</Label>
                <Input
                  id="cityName"
                  placeholder="e.g., Boulder"
                  value={formData.cityName}
                  onChange={(e) =>
                    setFormData({ ...formData, cityName: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="codeName">Code Name *</Label>
                <Input
                  id="codeName"
                  placeholder="e.g., Land Use Code"
                  value={formData.codeName}
                  onChange={(e) =>
                    setFormData({ ...formData, codeName: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="region">Region</Label>
                <Input
                  id="region"
                  placeholder="e.g., US - Mountain West"
                  value={formData.region}
                  onChange={(e) =>
                    setFormData({ ...formData, region: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="sourceUrl">Source URL *</Label>
                <Input
                  id="sourceUrl"
                  type="url"
                  placeholder="https://..."
                  value={formData.sourceUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, sourceUrl: e.target.value })
                  }
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  The URL to the zoning code page. The system will extract text
                  content from this URL.
                </p>
              </div>

              {error && (
                <div className="text-red-500 text-sm bg-red-50 p-3 rounded">
                  {error}
                </div>
              )}

              {success && (
                <div className="text-green-700 text-sm bg-green-50 p-3 rounded flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  {success}
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting Ingestion...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Ingest Code
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-8 text-sm text-muted-foreground">
          <h3 className="font-medium text-foreground mb-2">How it works:</h3>
          <ol className="list-decimal list-inside space-y-1">
            <li>Enter the municipality and code details</li>
            <li>
              Provide the URL to the official zoning code page
            </li>
            <li>
              The system crawls and extracts text from the page
            </li>
            <li>
              Text is chunked and embedded for RAG-based search
            </li>
            <li>
              Once complete, the code appears in your custom codes list
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
