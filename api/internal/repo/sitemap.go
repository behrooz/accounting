package repo

import (
	"encoding/xml"
	"net/url"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
)

type SitemapURL struct {
	Loc        string `xml:"loc"`
	LastMod    string `xml:"lastmod,omitempty"`
	ChangeFreq string `xml:"changefreq,omitempty"`
	Priority   string `xml:"priority,omitempty"`
}

type SitemapURLSet struct {
	XMLName xml.Name     `xml:"urlset"`
	Xmlns   string       `xml:"xmlns,attr"`
	URLs    []SitemapURL `xml:"url"`
}

// BuildStorefrontSitemap builds an XML sitemap for the public storefront.
func BuildStorefrontSitemap(db *sqlx.DB, siteOrigin string) ([]byte, error) {
	origin := strings.TrimRight(strings.TrimSpace(siteOrigin), "/")
	if origin == "" {
		origin = "https://abrangstyle.ir"
	}

	today := time.Now().UTC().Format("2006-01-02")
	urls := []SitemapURL{
		{Loc: origin + "/", ChangeFreq: "daily", Priority: "1.0", LastMod: today},
		{Loc: origin + "/shop.html", ChangeFreq: "daily", Priority: "0.9", LastMod: today},
		{Loc: origin + "/about.html", ChangeFreq: "monthly", Priority: "0.5", LastMod: today},
		{Loc: origin + "/contact.html", ChangeFreq: "monthly", Priority: "0.5", LastMod: today},
		{Loc: origin + "/terms.html", ChangeFreq: "yearly", Priority: "0.3", LastMod: today},
		{Loc: origin + "/privacy.html", ChangeFreq: "yearly", Priority: "0.3", LastMod: today},
		{Loc: origin + "/shipping.html", ChangeFreq: "yearly", Priority: "0.3", LastMod: today},
		{Loc: origin + "/returns.html", ChangeFreq: "yearly", Priority: "0.3", LastMod: today},
	}

	cats, err := ListCategories(db)
	if err == nil {
		for _, cat := range cats {
			if strings.TrimSpace(cat.Slug) == "" {
				continue
			}
			urls = append(urls, SitemapURL{
				Loc: origin + "/shop.html?cat=" + url.QueryEscape(cat.Slug) +
					"&categoryId=" + url.QueryEscape(cat.ID),
				ChangeFreq: "weekly",
				Priority:   "0.7",
				LastMod:    today,
			})
		}
	}

	products, err := ListProducts(db, ProductListFilter{Sort: "new"})
	if err == nil {
		for _, p := range products {
			if strings.TrimSpace(p.ID) == "" {
				continue
			}
			urls = append(urls, SitemapURL{
				Loc:        origin + "/product.html?id=" + url.QueryEscape(p.ID),
				ChangeFreq: "weekly",
				Priority:   "0.8",
				LastMod:    today,
			})
		}
	}

	doc := SitemapURLSet{
		Xmlns: "http://www.sitemaps.org/schemas/sitemap/0.9",
		URLs:  urls,
	}
	out, err := xml.MarshalIndent(doc, "", "  ")
	if err != nil {
		return nil, err
	}
	return append([]byte(xml.Header), out...), nil
}
