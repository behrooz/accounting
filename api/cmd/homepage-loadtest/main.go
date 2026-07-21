// Homepage load test: simulates many users opening index.html at the same time.
//
// Each virtual user fires the same parallel API requests as web/js/main.js on load:
//   GET /store/shop
//   GET /categories
//   GET /products?limit=10&offset=0
//
// Optionally also requests the static home page (WEB_URL).
//
// Usage (from api/):
//   go run ./cmd/homepage-loadtest
//   go run ./cmd/homepage-loadtest -users 100 -api http://localhost:8080/api
//   go run ./cmd/homepage-loadtest -users 100 -web http://localhost:3000 -api https://your-api/api
package main

import (
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"time"
)

type sample struct {
	label  string
	status int
	ms     float64
	err    string
}

func main() {
	users := flag.Int("users", 100, "number of virtual users arriving at the same time")
	webURL := flag.String("web", "", "optional storefront base URL (e.g. http://localhost:3000) to GET /index.html")
	apiURL := flag.String("api", envOr("API_BASE_URL", "http://localhost:8080/api"), "API base URL")
	timeout := flag.Duration("timeout", 30*time.Second, "per-request timeout")
	flag.Parse()

	api := strings.TrimRight(strings.TrimSpace(*apiURL), "/")
	if api == "" {
		fmt.Fprintln(os.Stderr, "api URL is required")
		os.Exit(2)
	}

	client := &http.Client{Timeout: *timeout}
	endpoints := []struct {
		label string
		url   string
	}{
		{"shop", api + "/store/shop"},
		{"categories", api + "/categories"},
		{"products", api + "/products?limit=10&offset=0"},
	}

	web := strings.TrimRight(strings.TrimSpace(*webURL), "/")
	if web != "" {
		endpoints = append([]struct {
			label string
			url   string
		}{{label: "index.html", url: web + "/index.html"}}, endpoints...)
	}

	fmt.Printf("Homepage load test\n")
	fmt.Printf("  users:    %d (all start together)\n", *users)
	fmt.Printf("  requests: %d per user (%d total burst)\n", len(endpoints), *users*len(endpoints))
	fmt.Printf("  api:      %s\n", api)
	if web != "" {
		fmt.Printf("  web:      %s\n", web)
	}
	fmt.Println()

	start := time.Now()
	results := make(chan sample, *users*len(endpoints))

	var wg sync.WaitGroup
	wg.Add(*users)
	for i := 0; i < *users; i++ {
		go func(user int) {
			defer wg.Done()
			var inner sync.WaitGroup
			for _, ep := range endpoints {
				inner.Add(1)
				go func(ep struct {
					label string
					url   string
				}) {
					defer inner.Done()
					results <- doGet(client, ep.label, ep.url)
				}(ep)
			}
			inner.Wait()
		}(i + 1)
	}
	wg.Wait()
	close(results)
	elapsed := time.Since(start)

	var all []sample
	byLabel := map[string][]sample{}
	for r := range results {
		all = append(all, r)
		byLabel[r.label] = append(byLabel[r.label], r)
	}

	printSummary(all, byLabel, elapsed)
}

func doGet(client *http.Client, label, url string) sample {
	t0 := time.Now()
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return sample{label: label, err: err.Error()}
	}
	req.Header.Set("Accept", "application/json, text/html")
	req.Header.Set("User-Agent", "abrang-homepage-loadtest/1.0")

	res, err := client.Do(req)
	ms := time.Since(t0).Seconds() * 1000
	if err != nil {
		return sample{label: label, ms: ms, err: err.Error()}
	}
	defer res.Body.Close()
	_, _ = io.Copy(io.Discard, res.Body)

	s := sample{label: label, status: res.StatusCode, ms: ms}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		s.err = fmt.Sprintf("HTTP %d", res.StatusCode)
	}
	return s
}

func printSummary(all []sample, byLabel map[string][]sample, elapsed time.Duration) {
	ok := 0
	fail := 0
	for _, s := range all {
		if s.err == "" && s.status >= 200 && s.status < 300 {
			ok++
		} else {
			fail++
		}
	}

	fmt.Printf("Finished in %.2fs\n", elapsed.Seconds())
	fmt.Printf("  total requests: %d\n", len(all))
	fmt.Printf("  success:        %d\n", ok)
	fmt.Printf("  failed:         %d\n", fail)
	if fail > 0 {
		fmt.Println("\nFailures (first 10):")
		shown := 0
		for _, s := range all {
			if s.err == "" && s.status >= 200 && s.status < 300 {
				continue
			}
			msg := s.err
			if msg == "" {
				msg = fmt.Sprintf("HTTP %d", s.status)
			}
			fmt.Printf("  %-12s %s\n", s.label, msg)
			shown++
			if shown >= 10 {
				break
			}
		}
	}

	labels := make([]string, 0, len(byLabel))
	for label := range byLabel {
		labels = append(labels, label)
	}
	sort.Strings(labels)

	fmt.Println("\nLatency (ms) per endpoint:")
	fmt.Printf("  %-12s %6s %6s %6s %6s %6s\n", "endpoint", "min", "p50", "p95", "max", "ok")
	for _, label := range labels {
		printEndpointStats(byLabel[label])
	}

	allMs := make([]float64, 0, len(all))
	for _, s := range all {
		allMs = append(allMs, s.ms)
	}
	sort.Float64s(allMs)
	fmt.Printf("\nOverall latency (ms): min=%.0f p50=%.0f p95=%.0f max=%.0f\n",
		allMs[0], percentile(allMs, 50), percentile(allMs, 95), allMs[len(allMs)-1])

	if fail > 0 {
		os.Exit(1)
	}
}

func printEndpointStats(rows []sample) {
	ms := make([]float64, 0, len(rows))
	ok := 0
	for _, s := range rows {
		ms = append(ms, s.ms)
		if s.err == "" && s.status >= 200 && s.status < 300 {
			ok++
		}
	}
	sort.Float64s(ms)
	label := rows[0].label
	fmt.Printf("  %-12s %6.0f %6.0f %6.0f %6.0f %5d/%d\n",
		label, ms[0], percentile(ms, 50), percentile(ms, 95), ms[len(ms)-1], ok, len(rows))
}

func percentile(sorted []float64, p int) float64 {
	if len(sorted) == 0 {
		return 0
	}
	if p <= 0 {
		return sorted[0]
	}
	if p >= 100 {
		return sorted[len(sorted)-1]
	}
	idx := int(float64(len(sorted)-1) * float64(p) / 100.0)
	return sorted[idx]
}

func envOr(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}
