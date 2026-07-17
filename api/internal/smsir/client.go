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

	body, _ := json.Marshal(verifyRequest{
		Mobile:     mobile,
		TemplateID: c.TemplateID,
		Parameters: []verifyParameter{
			{Name: c.paramName(), Value: code},
		},
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
