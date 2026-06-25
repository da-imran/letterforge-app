"use client"

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Mail, 
  PlusCircle, 
  Loader2,
  CheckCircle2,
  MessageSquare,
  LifeBuoy
} from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

const ticketSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  reason: z.string().min(10, "Please provide more details (min 10 chars)"),
});

const wordSchema = z.object({
  word: z.string().min(2, "Word must be at least 2 letters").regex(/^[a-zA-Z]+$/, "Only letters are allowed"),
  context: z.string().min(5, "Please explain why this word should be added"),
});

type TicketValues = z.infer<typeof ticketSchema>;
type WordValues = z.infer<typeof wordSchema>;

export default function SupportPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const ticketForm = useForm<TicketValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { fullName: '', username: '', email: '', reason: '' },
  });

  const wordForm = useForm<WordValues>({
    resolver: zodResolver(wordSchema),
    defaultValues: { word: '', context: '' },
  });

  const onTicketSubmit = async (data: TicketValues) => {
    setIsSubmitting(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsSubmitting(false);
    ticketForm.reset();
    toast({
      title: "Ticket Sent!",
      description: "We've received your request and will get back to you soon.",
    });
  };

  const onWordSubmit = async (data: WordValues) => {
    setIsSubmitting(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsSubmitting(false);
    wordForm.reset();
    toast({
      title: "Word Submitted!",
      description: `"${data.word.toUpperCase()}" has been sent for dictionary review.`,
    });
  };

  return (
    <div className="container max-w-4xl mx-auto px-4 py-12">
      <div className="flex flex-col items-center text-center space-y-4 mb-12">
        <div className="p-3 rounded-2xl bg-primary/10 text-primary">
          <LifeBuoy className="w-10 h-10" />
        </div>
        <h1 className="text-4xl font-black font-headline tracking-tight">Support Center</h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Report any issues or bugs discovered in this game. You may also report faulty words or provide suggestions to help us enhance our database!
        </p>
      </div>

      <Tabs defaultValue="ticket" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-8 bg-muted/50 p-1">
          <TabsTrigger value="ticket" className="gap-2">
            <Mail className="w-4 h-4" />
            Support Ticket
          </TabsTrigger>
          <TabsTrigger value="word" className="gap-2">
            <PlusCircle className="w-4 h-4" />
            Suggest Word
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ticket" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="bg-card/40 backdrop-blur-md border-border/50 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                Contact Us
              </CardTitle>
              <CardDescription>
                Encountered a bug or any issue? Send us a ticket and we'll reply shortly.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...ticketForm}>
                <form onSubmit={ticketForm.handleSubmit(onTicketSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={ticketForm.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" {...field} className="bg-background/50" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={ticketForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Game Username</FormLabel>
                          <FormControl>
                            <Input placeholder="forger_99" {...field} className="bg-background/50" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={ticketForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="john@example.com" {...field} className="bg-background/50" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={ticketForm.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Message / Reason</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe your issue in detail..." 
                            className="min-h-[150px] bg-background/50 resize-none"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Mail className="w-5 h-5 mr-2" />}
                    Send Support Ticket
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="word" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="bg-card/40 backdrop-blur-md border-border/50 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-secondary" />
                Expand the Dictionary
              </CardTitle>
              <CardDescription>
                Found a valid word that isn't working? Submit it here so our team can review and add it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...wordForm}>
                <form onSubmit={wordForm.handleSubmit(onWordSubmit)} className="space-y-6">
                  <FormField
                    control={wordForm.control}
                    name="word"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>The Missing Word</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="FORGED..." 
                            className="uppercase tracking-widest font-black text-xl h-14 bg-background/50 text-center" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={wordForm.control}
                    name="context"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Why should this be added?</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="e.g. This is a common medical term or widely used slang..." 
                            className="min-h-[120px] bg-background/50 resize-none"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" variant="secondary" className="w-full h-12 text-lg font-bold" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                    Submit for Review
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}