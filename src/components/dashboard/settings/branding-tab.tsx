"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadLogo, removeLogo, updateBrandColor } from "@/app/actions/settings";
import type { OrgSettings } from "@/app/actions/settings";

export function BrandingTab({ settings }: { settings: OrgSettings }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(settings.logoUrl);
  const [logoLoading, setLogoLoading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [color, setColor] = useState(settings.brandColor ?? "#6366f1");
  const [colorHex, setColorHex] = useState(settings.brandColor ?? "#6366f1");
  const [colorLoading, setColorLoading] = useState(false);
  const [colorSuccess, setColorSuccess] = useState(false);
  const [colorError, setColorError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canEdit = settings.role === "owner" || settings.role === "admin";

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setLogoError(null);
    setLogoLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const result = await uploadLogo(fd);
      if (result.error) {
        setLogoError(result.error);
      } else if (result.logoUrl) {
        setLogoUrl(result.logoUrl);
      }
    } finally {
      setLogoLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleRemoveLogo() {
    setLogoError(null);
    setLogoLoading(true);
    try {
      const result = await removeLogo();
      if (result.error) {
        setLogoError(result.error);
      } else {
        setLogoUrl(null);
      }
    } finally {
      setLogoLoading(false);
    }
  }

  async function handleSaveColor() {
    setColorError(null);
    setColorSuccess(false);
    setColorLoading(true);
    try {
      const result = await updateBrandColor(colorHex);
      if (result.error) {
        setColorError(result.error);
      } else {
        setColorSuccess(true);
      }
    } finally {
      setColorLoading(false);
    }
  }

  function handleColorPickerChange(value: string) {
    setColor(value);
    setColorHex(value);
  }

  function handleHexInputChange(value: string) {
    setColorHex(value);
    if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
      setColor(value);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
          <CardDescription>
            Upload your company logo (PNG, JPG, or SVG, max 2MB)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {logoError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {logoError}
            </div>
          )}
          {logoUrl && (
            <div className="flex items-center gap-4">
              <img
                src={logoUrl}
                alt="Organization logo"
                className="h-16 w-16 rounded-md border object-contain"
              />
              {canEdit && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleRemoveLogo}
                  disabled={logoLoading}
                >
                  Remove
                </Button>
              )}
            </div>
          )}
          {canEdit && (
            <div className="flex items-center gap-2">
              <Input
                ref={fileRef}
                type="file"
                accept=".png,.jpg,.jpeg,.svg"
                className="max-w-xs"
              />
              <Button
                onClick={handleUpload}
                disabled={logoLoading}
                size="sm"
              >
                {logoLoading ? "Uploading..." : "Upload"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Brand Color</CardTitle>
          <CardDescription>
            Choose a brand color for your recovery emails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {colorSuccess && (
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
              Brand color saved.
            </div>
          )}
          {colorError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {colorError}
            </div>
          )}
          <div className="flex items-center gap-4">
            <div
              className="h-10 w-10 rounded-md border"
              style={{ backgroundColor: color }}
            />
            <div className="flex items-center gap-2">
              <Label htmlFor="colorPicker" className="sr-only">
                Color picker
              </Label>
              <input
                id="colorPicker"
                type="color"
                value={color}
                onChange={(e) => handleColorPickerChange(e.target.value)}
                disabled={!canEdit}
                className="h-10 w-10 cursor-pointer rounded border-0 p-0"
              />
              <Input
                value={colorHex}
                onChange={(e) => handleHexInputChange(e.target.value)}
                placeholder="#6366f1"
                className="w-28"
                disabled={!canEdit}
              />
            </div>
          </div>
          {canEdit && (
            <Button
              onClick={handleSaveColor}
              disabled={colorLoading}
              size="sm"
            >
              {colorLoading ? "Saving..." : "Save Color"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
