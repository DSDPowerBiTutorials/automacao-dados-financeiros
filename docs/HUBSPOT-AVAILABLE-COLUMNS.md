# 📊 Colunas Disponíveis do HubSpot - Tabela Deals

**Total de Colunas Disponíveis: 239**
**Última Atualização: 2026-01-04**
**Database: Jorge9660**

---

## 🎯 Colunas Recomendadas para Reconciliação

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `DealId` | bigint | ID único do deal |
| `dealname` | nvarchar | Nome do deal |
| `closedate` | datetime | Data de fechamento do deal |
| `createdate` | datetime | Data de criação do deal |
| `amount` | numeric | Valor do deal |
| `amount_in_home_currency` | numeric | Valor em moeda local |
| `dealstage` | nvarchar | Estágio do deal |
| `deal_pipeline` | nvarchar | Pipeline do deal |
| `deal_currency_code` | nvarchar | Código da moeda |
| `hubspot_owner_id` | bigint | ID do proprietário |
| `hs_primary_associated_company` | numeric | Empresa associada |
| `hs_closed_won_date` | datetime | Data do ganho confirmado |
| `hs_lastmodifieddate` | datetime | Data da última modificação |
| `contact_s_name` | nvarchar | Nome do contato |
| `description` | nvarchar | Descrição do deal |

---

## 📋 Resumo por Tipo de Dado

### 🔤 NVARCHAR (122 colunas)
Campos de texto/string - Usado para nomes, descrições, códigos, etc.

**Alguns exemplos:**
- abandoned_cart_url
- after_wdsd_
- align_id
- audit_processing
- closed_lost_reason
- closed_won_reason
- consultancy
- contact_s_name
- country
- coupon_code
- deal_currency_code
- dealname
- dealstage
- dealtype
- description
- discount_amount
- dsd_app_plan
- dsd_audit
- dsd_clinical_consultancy_setup_activation_completed
- ecommerce_deal
- ecommerce_deal_stage
- ecommerce_deal_type

[... e mais 99 colunas]

---

### 🔢 NUMERIC (66 colunas)
Campos numéricos - Usado para valores, porcentagens, IDs, etc.

**Alguns exemplos:**
- amount
- amount_in_home_currency
- days_to_close
- discount_savings
- dsd_affiliate_commission_fee__
- hs_acv
- hs_arr
- hs_closed_amount
- hs_closed_amount_in_home_currency
- hs_closed_won_count
- hs_deal_score
- hs_exchange_rate
- hs_forecast_amount
- hs_likelihood_to_close
- hs_mrr
- hs_tcv
- internal_eec
- ip__ecomm_bridge__discount_amount
- ip__ecomm_bridge__tax_amount
- recurring_revenue_amount
- tax_price
- total_payment

[... e mais 44 colunas]

---

### 📅 DATETIME (36 colunas)
Campos de data/hora - Usado para datas de eventos, timestamps, etc.

**Exemplos:**
- closedate
- contract_signed_date_only_for_align_coll_and_tps_pipeline
- createdate
- date_deal_stage_completed__course_completed_
- date_other_wdsd_deal_occured
- dsd_mastership_start_date
- engagements_last_meeting_booked
- failed_payment_timestamp
- hs_closed_won_date
- hs_createdate
- hs_latest_meeting_activity
- hs_lastmodifieddate
- hs_next_step_updated_at
- hs_sales_email_last_replied
- hs_v2_time_in_current_stage
- hubspot_owner_assigneddate
- last_verified_date
- notes_last_contacted
- notes_last_updated
- notes_next_activity_date
- hs_closed_deal_close_date
- hs_open_deal_create_date
- hs_latest_marketing_email_click_date
- hs_latest_marketing_email_open_date
- hs_latest_marketing_email_reply_date
- hs_latest_sales_email_click_date
- hs_latest_sales_email_open_date
- hs_latest_sales_email_reply_date
- hs_is_stalled_after_timestamp
- hs_next_meeting_start_time
- hs_last_gs_shared_message
- hs_last_partner_shared_message_date
- hs_last_shared_message_create_date
- recurring_revenue_inactive_date
- sent_to_shalini_date_only_for_align_coll_and_tps_pipeline

---

### ⚙️ BIT (13 colunas)
Campos booleanos - Usado para flags true/false

- hs_has_empty_conditional_stage_properties
- hs_is_closed
- hs_is_closed_won
- hs_is_deal_split
- hs_is_open_count (boolean)
- hs_line_item_global_term_hs_discount_percentage_enabled
- hs_line_item_global_term_hs_recurring_billing_period_enabled
- hs_line_item_global_term_hs_recurring_billing_start_date_enabled
- hs_line_item_global_term_recurringbillingfrequency_enabled
- hs_read_only
- hs_was_imported
- hs_is_in_first_deal_stage
- hs_is_closed_lost
- hs_is_stalled

---

### 🔑 BIGINT (2 colunas)
Inteiros grandes - Usado para IDs

- DealId (required)
- hubspot_owner_id

---

## 📑 Lista Completa Ordenada Alfabeticamente

001. DealId
002. abandoned_cart_url
003. after_wdsd_
004. align_id
005. amount
006. amount_in_home_currency
007. audit_processing
008. closed_lost_reason
009. closed_won_reason
010. closedate
011. consultancy
012. contact_s_name
013. contract_signed_date_only_for_align_coll_and_tps_pipeline
014. country
015. coupon_code
016. createdate
017. date_deal_stage_completed__course_completed_
018. date_other_wdsd_deal_occured
019. days_to_close
020. deal_currency_code
021. deal_lost_type
022. deal_number
023. deal_pipeline
024. dealname
025. dealstage
026. dealtype
027. description
028. discount_amount
029. discount_savings
030. dsd_affiliate_commission_fee__
031. dsd_app_plan
032. dsd_audit
033. dsd_clinical_consultancy_setup_activation_completed
034. dsd_consultancy_setup_activation_completed
035. dsd_courses_deals
036. dsd_mastership_setup_activation_completed
037. dsd_mastership_start_date
038. ecommerce_deal
039. ecommerce_deal_stage
040. ecommerce_deal_type
041. engagements_last_meeting_booked
042. engagements_last_meeting_booked_campaign
043. engagements_last_meeting_booked_medium
044. engagements_last_meeting_booked_source
045. failed_payment_timestamp
046. hot_or_not
047. hs_acv
048. hs_all_accessible_team_ids
049. hs_all_collaborator_owner_ids
050. hs_all_deal_split_owner_ids
051. hs_all_owner_ids
052. hs_all_team_ids
053. hs_analytics_latest_source
054. hs_analytics_latest_source_company
055. hs_analytics_latest_source_contact
056. hs_analytics_latest_source_data_1
057. hs_analytics_latest_source_data_1_company
058. hs_analytics_latest_source_data_1_contact
059. hs_analytics_latest_source_data_2
060. hs_analytics_latest_source_data_2_company
061. hs_analytics_latest_source_data_2_contact
062. hs_analytics_latest_source_timestamp
063. hs_analytics_latest_source_timestamp_company
064. hs_analytics_latest_source_timestamp_contact
065. hs_analytics_source
066. hs_analytics_source_data_1
067. hs_analytics_source_data_2
068. hs_arr
069. hs_closed_amount
070. hs_closed_amount_in_home_currency
071. hs_closed_won_count
072. hs_closed_won_date
073. hs_created_by_user_id
074. hs_createdate
075. hs_days_to_close_raw
076. hs_deal_amount_calculation_preference
077. hs_deal_score
078. hs_deal_stage_probability
079. hs_deal_stage_probability_shadow
080. hs_exchange_rate
081. hs_forecast_amount
082. hs_forecast_probability
083. hs_has_empty_conditional_stage_properties
084. hs_is_closed
085. hs_is_closed_won
086. hs_is_deal_split
087. hs_is_open_count
088. hs_lastmodifieddate
089. hs_latest_meeting_activity
090. hs_likelihood_to_close
091. hs_line_item_global_term_hs_discount_percentage
092. hs_line_item_global_term_hs_discount_percentage_enabled
093. hs_line_item_global_term_hs_recurring_billing_period
094. hs_line_item_global_term_hs_recurring_billing_period_enabled
095. hs_line_item_global_term_hs_recurring_billing_start_date
096. hs_line_item_global_term_hs_recurring_billing_start_date_enabled
097. hs_line_item_global_term_recurringbillingfrequency
098. hs_line_item_global_term_recurringbillingfrequency_enabled
099. hs_manual_forecast_category
100. hs_merged_object_ids
101. hs_mrr
102. hs_next_step
103. hs_notes_next_activity_type
104. hs_num_associated_deal_splits
105. hs_num_of_associated_line_items
106. hs_num_target_accounts
107. hs_object_id
108. hs_object_source
109. hs_object_source_detail_1
110. hs_object_source_detail_2
111. hs_object_source_detail_3
112. hs_object_source_id
113. hs_object_source_label
114. hs_object_source_user_id
115. hs_pinned_engagement_id
116. hs_predicted_amount
117. hs_predicted_amount_in_home_currency
118. hs_priority
119. hs_projected_amount
120. hs_projected_amount_in_home_currency
121. hs_read_only
122. hs_sales_email_last_replied
123. hs_support_workflows_april_2021
124. hs_tag_ids
125. hs_tcv
126. hs_unique_creation_key
127. hs_updated_by_user_id
128. hs_user_ids_of_all_notification_followers
129. hs_user_ids_of_all_notification_unfollowers
130. hs_user_ids_of_all_owners
131. hs_was_imported
132. hubspot_owner_assigneddate
133. hubspot_owner_id
134. hubspot_team_id
135. implementation_products
136. inbox_id
137. internal_eec
138. invisalign_provider_id
139. invisalign_provider_name
140. ip__ecomm_bridge__abandoned_cart_url
141. ip__ecomm_bridge__discount_amount
142. ip__ecomm_bridge__ecomm_synced
143. ip__ecomm_bridge__order_number
144. ip__ecomm_bridge__shipment_ids
145. ip__ecomm_bridge__source_app_id
146. ip__ecomm_bridge__source_store_id
147. ip__ecomm_bridge__tax_amount
148. ip__sync_extension__external_source_account_id
149. ip__sync_extension__external_source_app_id
150. last_verified_date
151. notes_last_contacted
152. notes_last_updated
153. notes_next_activity_date
154. num_associated_contacts
155. num_contacted_notes
156. num_notes
157. order_correction_type
158. owners_region
159. paid_status
160. pc_deal
161. pending_reschedule
162. pipeline
163. products_service_exchange
164. purchased_consultancy_after_wdsd_
165. purchased_dsd_coordinators_after_wdsd_
166. purchased_dsd_mastership_after_wdsd_
167. purchased_r2_after_wdsd_
168. recurring_revenue_amount
169. recurring_revenue_deal_type
170. recurring_revenue_inactive_date
171. recurring_revenue_inactive_reason
172. selling_method
173. sent_to_shalini_date_only_for_align_coll_and_tps_pipeline
174. service_deliverables
175. services_delivery_team
176. tax_price
177. team_beneficiaries
178. total_payment
179. trigger_start_date_mastership
180. used_pc_in_the_past_12_months
181. used_pc_in_the_past_3_months
182. used_pc_over_12_months
183. website_order_id
184. website_review_url
185. website_source
186. hs_is_in_first_deal_stage
187. hs_closed_deal_close_date
188. hs_closed_deal_create_date
189. hs_open_deal_create_date
190. hs_latest_approval_status
191. hs_latest_approval_status_approval_id
192. hs_is_closed_count
193. hs_next_step_updated_at
194. hs_is_closed_lost
195. hs_shared_team_ids
196. hs_shared_user_ids
197. hs_campaign
198. hs_v2_time_in_current_stage
199. hs_notes_last_activity
200. hs_notes_next_activity
201. deal_country
202. not_ready_reason
203. hs_owning_teams
204. hs_primary_associated_company
205. hs_next_meeting_id
206. hs_next_meeting_name
207. hs_next_meeting_start_time
208. hs_manual_campaign_ids
209. hs_open_amount_in_home_currency
210. type_of_partnership_deal
211. hs_net_pipeline_impact
212. hs_average_call_duration
213. hs_latest_marketing_email_click_date
214. hs_latest_marketing_email_open_date
215. hs_latest_marketing_email_reply_date
216. hs_latest_sales_email_click_date
217. hs_latest_sales_email_open_date
218. hs_latest_sales_email_reply_date
219. hs_number_of_call_engagements
220. hs_number_of_inbound_calls
221. hs_number_of_outbound_calls
222. hs_number_of_overdue_tasks
223. hs_number_of_scheduled_meetings
224. hs_average_deal_owner_duration_in_current_stage
225. hs_is_stalled_after_timestamp
226. hs_weighted_pipeline_in_company_currency
227. hs_is_stalled
228. time_from_new_to_1st_approach
229. time_from_new_to_appointment_scheduled
230. offer
231. hs_attributed_team_ids
232. time_from_new_to_reached_out
233. hs_actual_duration
234. referral
235. time_between_new_to_meeting
236. time_from_meeting_stage_to_won_stage
237. hs_last_gs_shared_message
238. hs_last_partner_shared_message_date
239. hs_last_shared_message_create_date

---

## 💡 Como Usar Essas Colunas

### Exemplo: Adicionar Coluna à Sincronização

Se você quiser adicionar uma nova coluna à sincronização, edite o arquivo:
**`src/app/api/hubspot/sync/route.ts`**

```typescript
// Encontre esta seção:
const colId = findColumn(['DealId', 'deal_id', 'dealid', 'id']);
const colName = findColumn(['dealname', 'deal_name', 'name', 'title']);
const colAmount = findColumn(['amount', 'value', 'deal_amount', 'amount_in_home_currency']);

// E adicione nova coluna:
const colMyNewColumn = findColumn(['my_column_name', 'alternative_name']);
```

Então use no objeto de retorno:
```typescript
custom_data: {
    deal_id: dealId,
    my_column: colMyNewColumn ? deal[colMyNewColumn] : null,
    // ... outras colunas
},
```

---

## 🔗 Referências

- Arquivo JSON com estrutura completa: `docs/HUBSPOT-AVAILABLE-COLUMNS.json`
- Script de listagem: `scripts/list-hubspot-columns.js`
- Sincronização: `src/app/api/hubspot/sync/route.ts`
- Página de Deals: `src/app/reports/hubspot/page.tsx`
