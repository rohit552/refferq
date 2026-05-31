'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Loader2, School } from 'lucide-react';

const BOARDS = ['CBSE', 'ICSE', 'State Board', 'IB', 'IGCSE', 'Other'];

interface SchoolInterestFormProps {
  onSubmit: (data: {
    schoolName: string;
    schoolBoard: string;
    state: string;
    district: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
  }) => Promise<void>;
  defaultState?: string | null;
  defaultDistrict?: string | null;
}

export function SchoolInterestForm({
  onSubmit,
  defaultState,
  defaultDistrict,
}: SchoolInterestFormProps) {
  const [schoolName, setSchoolName] = useState('');
  const [schoolBoard, setSchoolBoard] = useState('');
  const [state, setState] = useState(defaultState || '');
  const [district, setDistrict] = useState(defaultDistrict || '');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSubmit({
        schoolName,
        schoolBoard,
        state,
        district,
        contactName,
        contactEmail,
        contactPhone,
      });
      setDone(true);
    } catch (_e) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <Card id="register-school" className="border-primary/20 shadow-lg">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-xl font-semibold">Thank you!</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            Your school onboarding request has been received. Your assigned NEP
            partner will reach out to {contactEmail || 'you'} shortly.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="register-school" className="border-primary/20 shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
          <School className="h-5 w-5 text-primary" />
          <CardTitle className="text-xl">Register your school</CardTitle>
        </div>
        <CardDescription>
          Start your NEP onboarding. A partner will be assigned to guide you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-2">
            <Label htmlFor="schoolName">School name</Label>
            <Input
              id="schoolName"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              required
              placeholder="e.g. Sunrise Public School"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="board">Board</Label>
              <Select value={schoolBoard} onValueChange={setSchoolBoard}>
                <SelectTrigger id="board">
                  <SelectValue placeholder="Select board" />
                </SelectTrigger>
                <SelectContent>
                  {BOARDS.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                required
                placeholder="State"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="district">District</Label>
              <Input
                id="district"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="District"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="principal">Principal / contact name</Label>
              <Input
                id="principal"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                required
                placeholder="Full name"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                required
                placeholder="you@school.edu"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+91"
              />
            </div>
          </div>

          <Button type="submit" size="lg" className="mt-2 w-full" disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <School className="mr-2 h-4 w-4" />
            )}
            {loading ? 'Submitting...' : 'Submit onboarding request'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
