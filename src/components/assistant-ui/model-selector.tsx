"use client";

import { useState, useEffect } from "react";
import { Check, Bot } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface ModelInfo {
  name: string;
  size: string;
  isLoaded: boolean;
}

interface ModelSelectorProps {
  onModelChange?: (modelName: string) => void;
}

export function ModelSelector({ onModelChange }: ModelSelectorProps) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [currentModel, setCurrentModel] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadAvailableModels();
    checkCurrentModel();
  }, []);

  const loadAvailableModels = async () => {
    try {
      const response = await window.electronAPI.llm.getAvailableModels();
      if (response.success && response.models) {
        const modelInfos: ModelInfo[] = response.models.map((model: string) => ({
          name: model.replace('.gguf', ''),
          size: 'Unknown',
          isLoaded: false,
        }));
        setModels(modelInfos);
      }
    } catch (error) {
      console.error('Failed to load available models:', error);
    }
  };

  const checkCurrentModel = async () => {
    try {
      const response = await window.electronAPI.llm.getModelInfo();
      if (response.isLoaded && response.modelName) {
        setCurrentModel(response.modelName.replace('.gguf', ''));
      }
    } catch (error) {
      console.error('Failed to check current model:', error);
    }
  };

  const handleModelChange = async (modelName: string) => {
    setIsLoading(true);
    try {
      // For now, we'll just update the UI
      // In a full implementation, you'd switch the model in the LLM service
      setCurrentModel(modelName);
      onModelChange?.(modelName);
      
      // Reinitialize the LLM service to load the new model
      await window.electronAPI.llm.reinitialize();
      
    } catch (error) {
      console.error('Failed to change model:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (models.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Bot className="h-4 w-4" />
        <span>No models available</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-sm">
        <Bot className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">Model:</span>
      </div>
      
      <Select value={currentModel} onValueChange={handleModelChange} disabled={isLoading}>
        <SelectTrigger className="w-[200px] h-8">
          <SelectValue placeholder="Select a model">
            {currentModel && (
              <div className="flex items-center gap-2">
                <span className="truncate">{currentModel}</span>
                {currentModel && (
                  <Badge variant="secondary" className="h-4 px-1 text-xs">
                    Active
                  </Badge>
                )}
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {models.map((model) => (
            <SelectItem key={model.name} value={model.name}>
              <div className="flex items-center justify-between w-full">
                <div className="flex flex-col">
                  <span className="font-medium">{model.name}</span>
                  <span className="text-xs text-muted-foreground">{model.size}</span>
                </div>
                {currentModel === model.name && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {isLoading && (
        <div className="text-xs text-muted-foreground">
          Switching...
        </div>
      )}
    </div>
  );
}
