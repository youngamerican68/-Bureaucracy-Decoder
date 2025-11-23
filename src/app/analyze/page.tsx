'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  Send,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { featuredMetros, getMetrosByRegion } from '@/lib/featured-metros';
import {
  AskZoningResponse,
  PreapprovalPacket,
  PreapprovalUserInput,
  PacketSection,
  ComplianceStatus,
} from '@/types';

function AnalyzePageContent() {
  const searchParams = useSearchParams();
  const initialCity = searchParams.get('city');

  const [selectedCity, setSelectedCity] = useState<string>(initialCity || '');
  const [activeTab, setActiveTab] = useState('ask');

  // Q&A state
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<AskZoningResponse | null>(null);
  const [askLoading, setAskLoading] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Pre-Approval state
  const [userInput, setUserInput] = useState<PreapprovalUserInput>({
    parcelZone: '',
    lotSize: undefined,
    lotSizeUnit: 'sqft',
    proposedUse: '',
    numberOfStories: undefined,
    buildingHeight: undefined,
    heightUnit: 'feet',
    unitCount: undefined,
    overlays: [],
    additionalNotes: '',
  });
  const [packet, setPacket] = useState<PreapprovalPacket | null>(null);
  const [packetLoading, setPacketLoading] = useState(false);
  const [packetError, setPacketError] = useState<string | null>(null);

  const selectedMetro = featuredMetros.find((m) => m.slug === selectedCity);
  const metrosByRegion = getMetrosByRegion();

  const scrollToCitation = (citationId: string) => {
    const element = document.getElementById(citationId);
    if (element) {
      setHighlightedId(citationId);
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Clear highlight after 3 seconds
      setTimeout(() => setHighlightedId(null), 3000);
    }
  };

  const renderAnswerWithClickableCitations = (text: string, citations: any[]) => {
    // Pattern to match citations in multiple formats:
    // - Legal symbols: §12.21, §12.21.A, §12.21.A.1
    // - Brackets: [Sec. 12.21], [Sec 12.21]
    // - Full word: Section 12.08, Section 12.21.A
    const citationPattern = /(§[\d.]+[A-Za-z0-9.]*|\[Sec\.?\s+[\d.]+[A-Za-z0-9.]*\]|Section\s+[\d.]+[A-Za-z0-9.]*)/g;
    const parts = text.split(citationPattern);

    // Build a set of normalized citation IDs for fast lookup
    const availableCitationIds = new Set(
      citations.map(c => `citation-${c.section_ref.replace(/[^a-zA-Z0-9]/g, '-')}`)
    );

    return parts.map((part, index) => {
      if (part.match(citationPattern)) {
        // Extract the section reference from the citation text
        // Strip out symbols, brackets, and "Section" prefix to get just the numbers/letters
        const sectionRef = part
          .replace(/^§/, '')
          .replace(/^\[Sec\.?\s+/, '')
          .replace(/\]$/, '')
          .replace(/^Section\s+/, '')
          .trim();

        // Generate consistent ID by stripping all special characters
        const citationId = `citation-${sectionRef.replace(/[^a-zA-Z0-9]/g, '-')}`;

        // Check if this citation exists in the retrieved citations
        const isAvailable = availableCitationIds.has(citationId);

        if (isAvailable) {
          // Clickable citation (found in sidebar)
          return (
            <button
              key={index}
              onClick={() => scrollToCitation(citationId)}
              className="text-amber-600 hover:text-amber-700 underline decoration-dotted underline-offset-2 font-medium cursor-pointer transition-colors"
            >
              {part}
            </button>
          );
        } else {
          // Non-clickable citation (not retrieved)
          return (
            <span
              key={index}
              className="text-gray-500 italic underline decoration-dotted underline-offset-2"
            >
              {part}
            </span>
          );
        }
      }
      return part;
    });
  };

  const handleAskQuestion = async () => {
    if (!selectedCity || !question.trim()) return;

    setAskLoading(true);
    setAskError(null);
    setAnswer(null);

    try {
      const response = await fetch('/api/zoning/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docId: selectedCity, // Using slug as ID for now
          question: question.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get answer');
      }

      const data = await response.json();
      setAnswer(data);
    } catch (err) {
      setAskError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setAskLoading(false);
    }
  };

  const handleGeneratePacket = async () => {
    if (!selectedCity) return;

    setPacketLoading(true);
    setPacketError(null);
    setPacket(null);

    try {
      const response = await fetch('/api/preapproval/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docId: selectedCity,
          userInput,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate packet');
      }

      const data = await response.json();
      setPacket(data.packet);
    } catch (err) {
      setPacketError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setPacketLoading(false);
    }
  };

  const getStatusIcon = (status: ComplianceStatus) => {
    switch (status) {
      case 'appears_compliant':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'likely_non_compliant':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'ambiguous':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <HelpCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: ComplianceStatus) => {
    switch (status) {
      case 'appears_compliant':
        return <Badge variant="success">Appears Compliant</Badge>;
      case 'likely_non_compliant':
        return <Badge variant="destructive">Likely Non-Compliant</Badge>;
      case 'ambiguous':
        return <Badge variant="warning">Ambiguous</Badge>;
      default:
        return <Badge variant="secondary">N/A</Badge>;
    }
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'low':
        return <Badge variant="success">Low Risk</Badge>;
      case 'medium':
        return <Badge variant="warning">Medium Risk</Badge>;
      case 'high':
        return <Badge variant="destructive">High Risk</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
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
              href="/ingest"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Add Code
            </Link>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* City Selector */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Select Jurisdiction</CardTitle>
            <CardDescription>
              Choose a metropolitan zoning code to analyze
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger className="w-full md:w-96">
                <SelectValue placeholder="Select a city..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(metrosByRegion).map(([region, metros]) => (
                  <div key={region}>
                    <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                      {region}
                    </div>
                    {metros.map((metro) => (
                      <SelectItem key={metro.slug} value={metro.slug}>
                        {metro.cityName} - {metro.codeName}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
            {selectedMetro && (
              <div className="mt-4 text-sm text-muted-foreground">
                <p>
                  <strong>Code:</strong> {selectedMetro.codeName}
                </p>
                <p>
                  <strong>Region:</strong> {selectedMetro.region}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedCity && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="ask">Ask the Code</TabsTrigger>
              <TabsTrigger value="packet">Pre-Approval Packet</TabsTrigger>
            </TabsList>

            {/* Ask the Code Tab */}
            <TabsContent value="ask">
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Ask a Question</CardTitle>
                    <CardDescription>
                      Query the zoning code in natural language
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      placeholder="e.g., What is the maximum building height in R4 zones?"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      rows={4}
                    />
                    <Button
                      onClick={handleAskQuestion}
                      disabled={!question.trim() || askLoading}
                    >
                      {askLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Ask
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Answer</CardTitle>
                    {answer && (
                      <Badge
                        variant={
                          answer.citations.length > 0 ? 'success' : 'secondary'
                        }
                      >
                        {answer.citations.length > 0
                          ? 'Verified Sources'
                          : 'No Sources Found'}
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent>
                    {askError && (
                      <div className="text-red-500 text-sm">{askError}</div>
                    )}
                    {answer && (
                      <div className="space-y-4">
                        <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                          {renderAnswerWithClickableCitations(answer.answer, answer.citations)}
                        </div>
                        {answer.citations.length > 0 && (
                          <div>
                            <h4 className="font-medium text-sm mb-2">
                              Citations
                            </h4>
                            <div className="space-y-2">
                              {answer.citations.map((citation, i) => {
                                const citationId = `citation-${citation.section_ref.replace(/[^a-zA-Z0-9]/g, '-')}`;
                                const isHighlighted = highlightedId === citationId;

                                return (
                                  <div
                                    key={i}
                                    id={citationId}
                                    className={`text-xs bg-muted p-2 rounded transition-all duration-300 ${
                                      isHighlighted
                                        ? 'ring-2 ring-amber-500 bg-amber-500/10 shadow-lg'
                                        : ''
                                    }`}
                                  >
                                    <span className="font-mono font-medium">
                                      {citation.section_ref}
                                    </span>
                                    <p className="text-muted-foreground mt-1">
                                      {citation.snippet}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {!answer && !askError && (
                      <p className="text-muted-foreground text-sm">
                        Ask a question to see the answer here.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Pre-Approval Packet Tab */}
            <TabsContent value="packet">
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Input Form */}
                <Card className="lg:col-span-1">
                  <CardHeader>
                    <CardTitle>Project Details</CardTitle>
                    <CardDescription>
                      Enter your proposed building parameters
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Parcel Zone</Label>
                      <Input
                        placeholder="e.g., R4, C2, M1"
                        value={userInput.parcelZone}
                        onChange={(e) =>
                          setUserInput({ ...userInput, parcelZone: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Lot Size</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="10000"
                          value={userInput.lotSize || ''}
                          onChange={(e) =>
                            setUserInput({
                              ...userInput,
                              lotSize: e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            })
                          }
                        />
                        <Select
                          value={userInput.lotSizeUnit}
                          onValueChange={(v) =>
                            setUserInput({
                              ...userInput,
                              lotSizeUnit: v as 'sqft' | 'acres',
                            })
                          }
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sqft">sq ft</SelectItem>
                            <SelectItem value="acres">acres</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Proposed Use</Label>
                      <Input
                        placeholder="e.g., Multifamily residential"
                        value={userInput.proposedUse}
                        onChange={(e) =>
                          setUserInput({ ...userInput, proposedUse: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Number of Stories</Label>
                      <Input
                        type="number"
                        placeholder="5"
                        value={userInput.numberOfStories || ''}
                        onChange={(e) =>
                          setUserInput({
                            ...userInput,
                            numberOfStories: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Building Height</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="55"
                          value={userInput.buildingHeight || ''}
                          onChange={(e) =>
                            setUserInput({
                              ...userInput,
                              buildingHeight: e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            })
                          }
                        />
                        <Select
                          value={userInput.heightUnit}
                          onValueChange={(v) =>
                            setUserInput({
                              ...userInput,
                              heightUnit: v as 'feet' | 'meters',
                            })
                          }
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="feet">feet</SelectItem>
                            <SelectItem value="meters">meters</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Unit Count</Label>
                      <Input
                        type="number"
                        placeholder="30"
                        value={userInput.unitCount || ''}
                        onChange={(e) =>
                          setUserInput({
                            ...userInput,
                            unitCount: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Additional Notes</Label>
                      <Textarea
                        placeholder="Any overlays, special districts, or other context..."
                        value={userInput.additionalNotes}
                        onChange={(e) =>
                          setUserInput({
                            ...userInput,
                            additionalNotes: e.target.value,
                          })
                        }
                        rows={3}
                      />
                    </div>
                    <Button
                      onClick={handleGeneratePacket}
                      disabled={packetLoading}
                      className="w-full"
                    >
                      {packetLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <FileText className="mr-2 h-4 w-4" />
                          Generate Packet
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Packet Display */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Pre-Approval Packet</CardTitle>
                    {packet && (
                      <div className="flex items-center gap-2">
                        {getRiskBadge(packet.overall_risk)}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    {packetError && (
                      <div className="text-red-500 text-sm mb-4">{packetError}</div>
                    )}
                    {packet && (
                      <div className="space-y-6">
                        {/* Summary */}
                        <div className="bg-muted p-4 rounded-lg">
                          <h4 className="font-medium mb-2">Summary</h4>
                          <p className="text-sm">{packet.summary}</p>
                        </div>

                        {/* Sections */}
                        <div className="space-y-4">
                          {packet.sections.map((section, i) => (
                            <div
                              key={i}
                              className="border rounded-lg p-4 space-y-3"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {getStatusIcon(section.status)}
                                  <h4 className="font-medium capitalize">
                                    {section.category.replace('_', ' ')}
                                  </h4>
                                </div>
                                {getStatusBadge(section.status)}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {section.analysis}
                              </p>
                              {section.citations.length > 0 && (
                                <div className="space-y-1">
                                  <p className="text-xs font-medium">Citations:</p>
                                  {section.citations.map((citation, j) => (
                                    <div
                                      key={j}
                                      className="text-xs bg-muted p-2 rounded"
                                    >
                                      <span className="font-mono">
                                        {citation.section_ref}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Disclaimer */}
                        <div className="text-xs text-muted-foreground border-t pt-4">
                          {packet.disclaimer}
                        </div>
                      </div>
                    )}
                    {!packet && !packetError && (
                      <p className="text-muted-foreground text-sm">
                        Enter project details and click Generate Packet to see
                        your pre-approval analysis.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {!selectedCity && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Select a jurisdiction above to start analyzing.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function AnalyzePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    }>
      <AnalyzePageContent />
    </Suspense>
  );
}
