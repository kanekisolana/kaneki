"use client";

import { useState } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/app/_components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/_components/ui/card";
import { Button } from "@/app/_components/ui/button";
import { AgentCard } from "../_components/agent-card";
import { BackroomCard } from "../_components/backroom-card";
import { Badge } from "@/app/_components/ui/badge";
import {
  Wallet,
  Twitter,
  Copy,
  ExternalLink,
  DollarSign,
  Bot,
  MessageSquare,
  Globe,
  Github,
  Linkedin,
} from "lucide-react";
import { api } from "@/trpc/react";
import { useUser } from "@/hooks/use-user";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/_components/ui/dialog";
import { Input } from "@/app/_components/ui/input";
import { Label } from "@/app/_components/ui/label";
import { Textarea } from "@/app/_components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export default function ProfilePage() {
  const { publicKey } = useUser();
  const { toast } = useToast();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    username: "",
    twitterHandle: "",
    bio: "",
    website: "",
    github: "",
    linkedin: "",
  });

  const {
    data: profile,
    refetch,
    isLoading,
  } = api.profile.get.useQuery(undefined, {
    enabled: !!publicKey,
  });

  const updateProfile = api.profile.update.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
      setIsEditOpen(false);
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = () => {
    if (!profile) return;
    setEditForm({
      username: profile.username ?? "",
      twitterHandle: profile.twitterHandle ?? "",
      bio: profile.bio ?? "",
      website: profile.website ?? "",
      github: profile.github ?? "",
      linkedin: profile.linkedin ?? "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate(editForm);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto flex min-h-screen items-center justify-center px-4 py-12 md:px-6">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-24 w-24 animate-pulse rounded-full bg-muted"></div>
          <div className="h-8 w-48 animate-pulse rounded-lg bg-muted"></div>
          <div className="h-4 w-32 animate-pulse rounded-lg bg-muted"></div>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <main className="container mx-auto px-4 py-12 md:px-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Your account information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center space-y-4">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-r from-purple-400 via-pink-500 to-amber-500 text-2xl font-bold text-white">
                  {profile.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="text-center">
                  <h2 className="text-2xl font-bold">{profile.username}</h2>
                  <p className="text-muted-foreground">
                    Member since {profile.joinDate.toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                  <div className="flex items-center">
                    <Wallet className="mr-3 h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Wallet</p>
                      <p className="max-w-[180px] truncate text-xs text-muted-foreground">
                        {profile.walletAddress.slice(0, 6)}...
                        {profile.walletAddress.slice(-4)}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        navigator.clipboard.writeText(profile.walletAddress);
                        toast({
                          title: "Success",
                          description: "Wallet address copied!",
                        });
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        window.open(
                          `https://solscan.io/account/${profile.walletAddress}`,
                          "_blank",
                        );
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {profile.twitterHandle && (
                  <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                    <div className="flex items-center">
                      <Twitter className="mr-3 h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Twitter</p>
                        <p className="text-xs text-muted-foreground">
                          {profile.twitterHandle}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        if (profile.twitterHandle) {
                          window.open(
                            `https://twitter.com/${profile.twitterHandle.replace(
                              "@",
                              "",
                            )}`,
                            "_blank",
                          );
                        }
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {profile.website && (
                  <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                    <div className="flex items-center">
                      <Globe className="mr-3 h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Website</p>
                        <p className="text-xs text-muted-foreground">
                          {profile.website}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        if (profile.website) {
                          window.open(profile.website, "_blank");
                        }
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {profile.github && (
                  <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                    <div className="flex items-center">
                      <Github className="mr-3 h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">GitHub</p>
                        <p className="text-xs text-muted-foreground">
                          {profile.github}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        if (profile.github) {
                          window.open(profile.github, "_blank");
                        }
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {profile.linkedin && (
                  <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                    <div className="flex items-center">
                      <Linkedin className="mr-3 h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">LinkedIn</p>
                        <p className="text-xs text-muted-foreground">
                          {profile.linkedin}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        if (profile.linkedin) {
                          window.open(profile.linkedin, "_blank");
                        }
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col items-center justify-center rounded-lg bg-muted p-3">
                  <DollarSign className="mb-1 h-5 w-5 text-green-500" />
                  <p className="text-sm font-medium">{profile.revenue} SOL</p>
                  <p className="text-xs text-muted-foreground">Revenue</p>
                </div>
                <div className="flex flex-col items-center justify-center rounded-lg bg-muted p-3">
                  <Bot className="mb-1 h-5 w-5 text-purple-500" />
                  <p className="text-sm font-medium">{profile.agentsCreated}</p>
                  <p className="text-xs text-muted-foreground">Agents</p>
                </div>
                <div className="flex flex-col items-center justify-center rounded-lg bg-muted p-3">
                  <MessageSquare className="mb-1 h-5 w-5 text-pink-500" />
                  <p className="text-sm font-medium">
                    {profile.backroomsCreated}
                  </p>
                  <p className="text-xs text-muted-foreground">Backrooms</p>
                </div>
              </div>

              <div className="pt-4">
                <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full" onClick={handleEdit}>
                      Edit Profile
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Profile</DialogTitle>
                      <DialogDescription>
                        Update your profile information
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          value={editForm.username}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              username: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="twitterHandle">Twitter Handle</Label>
                        <Input
                          id="twitterHandle"
                          value={editForm.twitterHandle}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              twitterHandle: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bio">Bio</Label>
                        <Textarea
                          id="bio"
                          value={editForm.bio}
                          onChange={(e) =>
                            setEditForm({ ...editForm, bio: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="website">Website</Label>
                        <Input
                          id="website"
                          value={editForm.website}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              website: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="github">GitHub</Label>
                        <Input
                          id="github"
                          value={editForm.github}
                          onChange={(e) =>
                            setEditForm({ ...editForm, github: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="linkedin">LinkedIn</Label>
                        <Input
                          id="linkedin"
                          value={editForm.linkedin}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              linkedin: e.target.value,
                            })
                          }
                        />
                      </div>
                      <Button type="submit" className="w-full">
                        Save Changes
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Tabs defaultValue="agents" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="agents" className="flex items-center gap-2">
                <Bot className="h-4 w-4" />
                My Agents
                {profile.agentsCreated > 0 && (
                  <Badge variant="secondary">{profile.agentsCreated}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="backrooms"
                className="flex items-center gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                My Backrooms
                {profile.backroomsCreated > 0 && (
                  <Badge variant="secondary">{profile.backroomsCreated}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="revenue" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Revenue
                {profile.revenue > 0 && (
                  <Badge variant="secondary">{profile.revenue} SOL</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="agents" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Your Agents</h2>
                <Button>Create New Agent</Button>
              </div>
              {profile.agents.length === 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>No Agents Yet</CardTitle>
                    <CardDescription>
                      Create your first AI agent to get started
                    </CardDescription>
                  </CardHeader>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {profile.agents.map((agent) => (
                    <AgentCard
                      key={agent.id}
                      id={agent.id}
                      name={agent.name}
                      description={agent.description}
                      creator={agent.creator}
                      likes={agent.likes ?? 0}
                      fee={agent.price ?? 0}
                      isPublic={agent.visibility === "public"}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="backrooms" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Your Backrooms</h2>
                <Button>Create New Backroom</Button>
              </div>
              {profile.backrooms.length === 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>No Backrooms Yet</CardTitle>
                    <CardDescription>
                      Create your first backroom to get started
                    </CardDescription>
                  </CardHeader>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {profile.backrooms.map((backroom) => (
                    <BackroomCard
                      key={backroom.id}
                      id={backroom.id}
                      name={backroom.name}
                      description={backroom.description}
                      creator={backroom.creator}
                      agentCount={backroom.agents.length}
                      createdAt={backroom.createdAt}
                      visibility={backroom.visibility}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="revenue" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue</CardTitle>
                  <CardDescription>
                    Track your earnings from agents and backrooms
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Total Revenue</p>
                      <p className="text-2xl font-bold">
                        {profile.revenue} SOL
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogTrigger asChild>
          <Button
            onClick={handleEdit}
            className="fixed bottom-4 right-4 z-50 md:hidden"
          >
            Edit Profile
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>
              Update your profile information
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={editForm.username}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    username: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="twitter">Twitter Handle</Label>
              <Input
                id="twitter"
                value={editForm.twitterHandle}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    twitterHandle: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={editForm.bio}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    bio: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={editForm.website}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    website: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="github">GitHub</Label>
              <Input
                id="github"
                value={editForm.github}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    github: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="linkedin">LinkedIn</Label>
              <Input
                id="linkedin"
                value={editForm.linkedin}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    linkedin: e.target.value,
                  }))
                }
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateProfile.isPending}
                className={updateProfile.isPending ? "animate-pulse" : ""}
              >
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
