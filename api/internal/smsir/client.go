package smsir

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const verifyURL = "https://api.sms.ir/v1/send/verify"

type Client struct {
	APIKey     string
	TemplateID int
	ParamName  string
	HTTP       *http.Client
}

type verifyRequest struct {
	Mobile     string             `json:"mobile"`
	TemplateID int                `json:"templateId"`
	Parameters []verifyParameter  `json:"parameters"`
}

type verifyParameter struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type verifyResponse struct {
	Status  int    `json:"status"`
	Message string `json:"message"`
}

func (c *Client) Enabled() bool {
	return strings.TrimSpace(c.APIKey) != "" && c.TemplateID > 0
}

func (c *Client) EnabledForTemplate(templateID int) bool {
	return strings.TrimSpace(c.APIKey) != "" && templateID > 0
}

func (c *Client) paramName() string {
	name := strings.TrimSpace(c.ParamName)
	if name == "" {
		return "CODE"
	}
	return name
}

func (c *Client) httpClient() *http.Client {
	if c.HTTP != nil {
		return c.HTTP
	}
	return &http.Client{Timeout: 15 * time.Second}
}

// SendVerify sends an OTP via sms.ir verify template.
func (c *Client) SendVerify(mobile, code string) error {
	if !c.Enabled() {
		return fmt.Errorf("sms.ir is not configured (SMS_IR_API_KEY / SMS_IR_TEMPLATE_ID)")
	}
	mobile = strings.TrimSpace(mobile)
	code = strings.TrimSpace(code)
	if mobile == "" || code == "" {
		return fmt.Errorf("mobile and code required")
	}
	return c.SendTemplate(c.TemplateID, mobile, map[string]string{
		c.paramName(): code,
	})
}

// SendTemplate sends an sms.ir verify template with arbitrary parameters.
func (c *Client) SendTemplate(templateID int, mobile string, params map[string]string) error {
	if !c.EnabledForTemplate(templateID) {
		return fmt.Errorf("sms.ir template %d is not configured", templateID)
	}
	mobile = strings.TrimSpace(mobile)
	if mobile == "" {
		return fmt.Errorf("mobile required")
	}

	parameters := make([]verifyParameter, 0, len(params))
	for name, value := range params {
		name = strings.TrimSpace(name)
		value = strings.TrimSpace(value)
		if name == "" || value == "" {
			continue
		}
		parameters = append(parameters, verifyParameter{Name: name, Value: value})
	}
	if len(parameters) == 0 {
		return fmt.Errorf("at least one template parameter required")
	}

	body, _ := json.Marshal(verifyRequest{
		Mobile:     mobile,
		TemplateID: templateID,
		Parameters: parameters,
	})

	req, err := http.NewRequest(http.MethodPost, verifyURL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("x-api-key", c.APIKey)

	res, err := c.httpClient().Do(req)
	if err != nil {
		return fmt.Errorf("sms.ir request failed: %w", err)
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)

	var parsed verifyResponse
	_ = json.Unmarshal(raw, &parsed)

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		msg := strings.TrimSpace(parsed.Message)
		if msg == "" {
			msg = strings.TrimSpace(string(raw))
		}
		if msg == "" {
			msg = res.Status
		}
		return fmt.Errorf("sms.ir error: %s", msg)
	}
	return nil
}
