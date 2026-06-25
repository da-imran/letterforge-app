
"use client"

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  HelpCircle, 
  Mail, 
  PlusCircle, 
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

export const SupportMenu = () => {
  const [activeDialog, setActiveDialog] = useState<'ticket' | 'word' | null>(null);
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
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsSubmitting(false);
    setActiveDialog(null);
    ticketForm.reset();
    toast({
      title: "Ticket Sent!",
      description: "We've received your request and will get back to you soon.",
    });
  };

  const onWordSubmit = async (data: WordValues) => {
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsSubmitting(false);
    setActiveDialog(null);
    wordForm.reset();
    toast({
      title: "Word Submitted!",
      description: `"${data.word.toUpperCase()}" has been sent for dictionary review.`,
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <HelpCircle className="w-4 h-4" />
            <span className="hidden md:inline">Support</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-card border-border">
          <DropdownMenuItem 
            onSelect={(e) => {
              e.preventDefault();
              setActiveDialog('ticket');
            }} 
            className="gap-2 cursor-pointer"
          >
            <Mail className="w-4 h-4 text-primary" />
            Send Support Ticket
          </DropdownMenuItem>
          <DropdownMenuItem 
            onSelect={(e) => {
              e.preventDefault();
              setActiveDialog('word');
            }} 
            className="gap-2 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-secondary" />
            Submit Missing Word
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={activeDialog === 'ticket'} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-[425px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Support Ticket
            </DialogTitle>
            <DialogDescription>
              Direct contact with the Forge owners. We usually respond within 24h.
            </DialogDescription>
          </DialogHeader>
          <Form {...ticketForm}>
            <form onSubmit={ticketForm.handleSubmit(onTicketSubmit)} className="space-y-4 pt-4">
              <FormField
                control={ticketForm.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={ticketForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="forger123" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={ticketForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="john@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={ticketForm.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason / Message</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe your issue or feedback..." 
                        className="min-h-[100px] resize-none"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
                Send Ticket
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === 'word'} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-[425px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-secondary" />
              Suggest New Word
            </DialogTitle>
            <DialogDescription>
              Help us improve the forge by adding legitimate words we might have missed.
            </DialogDescription>
          </DialogHeader>
          <Form {...wordForm}>
            <form onSubmit={wordForm.handleSubmit(onWordSubmit)} className="space-y-4 pt-4">
              <FormField
                control={wordForm.control}
                name="word"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>The Word</FormLabel>
                    <FormControl>
                      <Input placeholder="ENTER WORD..." className="uppercase tracking-widest font-bold" {...field} />
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
                        placeholder="e.g. This is a valid medical term / common slang..." 
                        className="min-h-[80px] resize-none"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" variant="secondary" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Submit for Review
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
};
