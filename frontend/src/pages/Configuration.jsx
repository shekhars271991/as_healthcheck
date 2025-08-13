import React, { useState, useEffect } from 'react';
import { Settings, Brain, Key, Save, CheckCircle, AlertCircle } from 'lucide-react';

const Configuration = () => {
  const [selectedModel, setSelectedModel] = useState('gemini');
  const [apiKey, setApiKey] = useState('');
  const [usingDefaultKey, setUsingDefaultKey] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  const models = [
    {
      id: 'gemini',
      name: 'Google Gemini',
      description: 'Google\'s Gemini Pro model for intelligent data parsing',
      enabled: true,
      provider: 'Google'
    },
    {
      id: 'gpt-4',
      name: 'OpenAI GPT-4',
      description: 'OpenAI\'s GPT-4 model for advanced analysis',
      enabled: false,
      provider: 'OpenAI'
    },
    {
      id: 'claude',
      name: 'Anthropic Claude',
      description: 'Anthropic\'s Claude model for reliable parsing',
      enabled: false,
      provider: 'Anthropic'
    }
  ];

  useEffect(() => {
    // Load current configuration
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      const response = await fetch('http://localhost:8000/config');
      if (response.ok) {
        const config = await response.json();
        setSelectedModel(config.model || 'gemini');
        setUsingDefaultKey(config.using_default_key || true);
        setApiKey(config.using_default_key ? '' : '***hidden***');
      }
    } catch (error) {
      console.error('Failed to load configuration:', error);
    }
  };

  const handleSaveConfiguration = async () => {
    setSaving(true);
    setSaveStatus(null);

    try {
      const payload = {
        model: selectedModel,
        ...(apiKey && apiKey !== '***hidden***' && { api_key: apiKey })
      };

      const response = await fetch('http://localhost:8000/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setSaveStatus('success');
        setUsingDefaultKey(!apiKey || apiKey === '***hidden***');
        setTimeout(() => setSaveStatus(null), 3000);
      } else {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus(null), 3000);
      }
    } catch (error) {
      console.error('Failed to save configuration:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Configuration</h1>
        <p className="text-gray-600">AI model and API configuration settings</p>
      </div>
      
      <div className="max-w-4xl space-y-8">
        {/* Model Selection */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <Brain className="h-5 w-5 text-blue-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">AI Model Selection</h2>
          </div>
          <p className="text-sm text-gray-600 mb-6">
            Choose the AI model for parsing and analyzing Aerospike health check data.
          </p>
          
          <div className="space-y-3">
            {models.map((model) => (
              <label
                key={model.id}
                className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                  model.enabled
                    ? selectedModel === model.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                    : 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-60'
                }`}
              >
                <input
                  type="radio"
                  name="model"
                  value={model.id}
                  checked={selectedModel === model.id}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={!model.enabled}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 disabled:opacity-50"
                />
                <div className="ml-3 flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-medium ${model.enabled ? 'text-gray-900' : 'text-gray-500'}`}>
                        {model.name}
                        {/* {!model.enabled && <span className="ml-2 text-xs text-gray-400">(Coming Soon)</span>} */}
                      </p>
                      <p className={`text-xs ${model.enabled ? 'text-gray-600' : 'text-gray-400'}`}>
                        {model.description}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      model.enabled 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {model.provider}
                    </span>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* API Key Configuration */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <Key className="h-5 w-5 text-green-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">API Key Configuration</h2>
          </div>
          <p className="text-sm text-gray-600 mb-6">
            Provide your own API key for the selected model. If not provided, the system will use a default key with rate limits.
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {selectedModel === 'gemini' ? 'Google Gemini API Key' : 
                 selectedModel === 'gpt-4' ? 'OpenAI API Key' : 
                 'Anthropic API Key'}
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={`Enter your ${models.find(m => m.id === selectedModel)?.provider} API key (optional)`}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to use default key. Your key will be encrypted and stored securely.
              </p>
            </div>
            
            {usingDefaultKey && (
              <div className="flex items-center p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <AlertCircle className="h-4 w-4 text-yellow-600 mr-2" />
                <span className="text-sm text-yellow-800">
                  Currently using default API key. Consider providing your own key to avoid rate limits.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="flex items-center space-x-2">
            {saveStatus === 'success' && (
              <>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-700">Configuration saved successfully</span>
              </>
            )}
            {saveStatus === 'error' && (
              <>
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm text-red-700">Failed to save configuration</span>
              </>
            )}
          </div>
          
          <button
            onClick={handleSaveConfiguration}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Configuration
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Configuration; 